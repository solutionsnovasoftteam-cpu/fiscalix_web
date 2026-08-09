-- Fiscalix · Etapa 4: actividades, compatibilidad y obligaciones sugeridas.
-- Ejecutar después de scripts/fiscal-profiles-stage-1.sql.
-- Es idempotente y no elimina ni sustituye datos existentes.

begin;

create extension if not exists pgcrypto;

create table if not exists public.actividades_economicas (
  id uuid primary key default gen_random_uuid(),
  clave varchar(40) not null unique,
  nombre varchar(180) not null,
  descripcion text,
  tipo_persona text not null default 'fisica' check (tipo_persona = 'fisica'),
  activo boolean not null default true,
  requiere_revision boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Catálogo funcional inicial. Son grupos operativos de Fiscalix, no claves SAT.
insert into public.actividades_economicas (clave, nombre, descripcion, requiere_revision)
values
  ('SERVICIOS_PROFESIONALES', 'Servicios profesionales', 'Prestación independiente de servicios profesionales.', false),
  ('ACTIVIDAD_EMPRESARIAL', 'Actividad empresarial', 'Comercio, industria u otra actividad empresarial.', false),
  ('ARRENDAMIENTO', 'Arrendamiento', 'Otorgamiento temporal del uso o goce de bienes inmuebles.', false),
  ('PLATAFORMAS_TECNOLOGICAS', 'Plataformas tecnológicas', 'Ingresos obtenidos mediante plataformas digitales.', false),
  ('SUELDOS_SALARIOS', 'Sueldos y salarios', 'Ingresos subordinados o asimilados a salarios.', false),
  ('INGRESOS_PASIVOS', 'Intereses o dividendos', 'Ingresos por intereses, dividendos u otras fuentes pasivas.', true),
  ('OTRA', 'Otra actividad o tipo de ingreso', 'Requiere revisión para determinar su tratamiento fiscal.', true)
on conflict (clave) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  requiere_revision = excluded.requiere_revision,
  updated_at = now();

create table if not exists public.empresa_actividad_fiscal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  empresa_fiscal_id uuid references public.empresa_fiscal(id) on delete cascade,
  actividad_id uuid not null references public.actividades_economicas(id) on delete restrict,
  descripcion_personalizada varchar(240),
  principal boolean not null default false,
  activa boolean not null default true,
  creado_por varchar references public.usuarios(id) on delete set null,
  actualizado_por varchar references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, actividad_id)
);

create unique index if not exists empresa_actividad_principal_idx
  on public.empresa_actividad_fiscal (empresa_id)
  where principal and activa;

create table if not exists public.empresa_regimen_adicional (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  empresa_fiscal_id uuid references public.empresa_fiscal(id) on delete cascade,
  regimen_id uuid not null references public.regimenes_fiscales(id) on delete restrict,
  estado_revision text not null default 'pendiente' check (
    estado_revision in ('compatible', 'condicionado', 'revision_profesional', 'pendiente')
  ),
  condicion_aceptada boolean not null default false,
  activo boolean not null default true,
  creado_por varchar references public.usuarios(id) on delete set null,
  actualizado_por varchar references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, regimen_id)
);

create table if not exists public.regimen_compatibilidad (
  id uuid primary key default gen_random_uuid(),
  regimen_origen_id uuid not null references public.regimenes_fiscales(id) on delete cascade,
  regimen_destino_id uuid not null references public.regimenes_fiscales(id) on delete cascade,
  resultado text not null check (
    resultado in ('compatible', 'condicionado', 'incompatible', 'revision_profesional')
  ),
  condicion text,
  fuente text,
  vigencia_desde date,
  vigencia_hasta date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (regimen_origen_id <> regimen_destino_id),
  check (vigencia_hasta is null or vigencia_desde is null or vigencia_hasta >= vigencia_desde),
  unique (regimen_origen_id, regimen_destino_id)
);

create table if not exists public.regimen_obligacion_sugerida (
  id uuid primary key default gen_random_uuid(),
  regimen_id uuid not null references public.regimenes_fiscales(id) on delete cascade,
  clave varchar(80) not null,
  nombre varchar(180) not null,
  descripcion text,
  impuesto varchar(40),
  periodicidad text check (periodicidad in ('mensual','bimestral','trimestral','semestral','anual','evento')),
  requerida boolean not null default false,
  condicion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (regimen_id, clave)
);

-- Aprovecha las obligaciones reales ya registradas para crear sugerencias sin
-- inventar obligaciones nuevas. El usuario deberá confirmarlas explícitamente.
insert into public.regimen_obligacion_sugerida (
  regimen_id, clave, nombre, descripcion, periodicidad, requerida
)
select distinct
  ef.regimen_id,
  left(regexp_replace(lower(coalesce(ofi.nombre, 'obligacion')), '[^a-z0-9]+', '_', 'g'), 80),
  ofi.nombre,
  ofi.descripcion,
  case when lower(coalesce(ofi.periodicidad, '')) in ('mensual','bimestral','trimestral','semestral','anual')
    then lower(ofi.periodicidad) else null end,
  false
from public.obligaciones_fiscales ofi
join public.empresa_fiscal ef on ef.empresa_id = ofi.empresa_id
where ef.regimen_id is not null and ofi.nombre is not null
on conflict (regimen_id, clave) do nothing;

create table if not exists public.empresa_obligacion_confirmacion (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sugerencia_id uuid not null references public.regimen_obligacion_sugerida(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmada','rechazada')),
  comentario text,
  confirmado_por varchar references public.usuarios(id) on delete set null,
  confirmado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, sugerencia_id)
);

create index if not exists empresa_actividad_empresa_idx on public.empresa_actividad_fiscal (empresa_id);
create index if not exists empresa_regimen_adicional_empresa_idx on public.empresa_regimen_adicional (empresa_id);
create index if not exists regimen_compatibilidad_origen_idx on public.regimen_compatibilidad (regimen_origen_id);
create index if not exists regimen_obligacion_regimen_idx on public.regimen_obligacion_sugerida (regimen_id);
create index if not exists empresa_obligacion_empresa_idx on public.empresa_obligacion_confirmacion (empresa_id);

drop trigger if exists actividades_economicas_updated_at_trigger on public.actividades_economicas;
create trigger actividades_economicas_updated_at_trigger before update on public.actividades_economicas
for each row execute function public.actualizar_updated_at_fiscal();
drop trigger if exists empresa_actividad_fiscal_updated_at_trigger on public.empresa_actividad_fiscal;
create trigger empresa_actividad_fiscal_updated_at_trigger before update on public.empresa_actividad_fiscal
for each row execute function public.actualizar_updated_at_fiscal();
drop trigger if exists empresa_regimen_adicional_updated_at_trigger on public.empresa_regimen_adicional;
create trigger empresa_regimen_adicional_updated_at_trigger before update on public.empresa_regimen_adicional
for each row execute function public.actualizar_updated_at_fiscal();
drop trigger if exists regimen_compatibilidad_updated_at_trigger on public.regimen_compatibilidad;
create trigger regimen_compatibilidad_updated_at_trigger before update on public.regimen_compatibilidad
for each row execute function public.actualizar_updated_at_fiscal();
drop trigger if exists regimen_obligacion_sugerida_updated_at_trigger on public.regimen_obligacion_sugerida;
create trigger regimen_obligacion_sugerida_updated_at_trigger before update on public.regimen_obligacion_sugerida
for each row execute function public.actualizar_updated_at_fiscal();
drop trigger if exists empresa_obligacion_confirmacion_updated_at_trigger on public.empresa_obligacion_confirmacion;
create trigger empresa_obligacion_confirmacion_updated_at_trigger before update on public.empresa_obligacion_confirmacion
for each row execute function public.actualizar_updated_at_fiscal();

alter table public.actividades_economicas enable row level security;
alter table public.empresa_actividad_fiscal enable row level security;
alter table public.empresa_regimen_adicional enable row level security;
alter table public.regimen_compatibilidad enable row level security;
alter table public.regimen_obligacion_sugerida enable row level security;
alter table public.empresa_obligacion_confirmacion enable row level security;

revoke all on table public.actividades_economicas from anon, authenticated;
revoke all on table public.empresa_actividad_fiscal from anon, authenticated;
revoke all on table public.empresa_regimen_adicional from anon, authenticated;
revoke all on table public.regimen_compatibilidad from anon, authenticated;
revoke all on table public.regimen_obligacion_sugerida from anon, authenticated;
revoke all on table public.empresa_obligacion_confirmacion from anon, authenticated;

commit;