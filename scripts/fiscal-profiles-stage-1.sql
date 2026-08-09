-- Fiscalix · Etapa 1: modelo fiscal base para personas físicas.
--
-- Este script amplía las tablas existentes; no crea un catálogo de regímenes
-- paralelo. Next.js usa la service role y Web/Mobile no deben consultar estas
-- tablas directamente.

begin;

create extension if not exists pgcrypto;

alter table public.regimenes_fiscales
  add column if not exists descripcion text,
  add column if not exists tipo_persona text not null default 'fisica',
  add column if not exists activo boolean not null default true,
  add column if not exists seleccionable_nuevo boolean not null default true,
  add column if not exists vigencia_desde date,
  add column if not exists vigencia_hasta date,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.regimenes_fiscales
  drop constraint if exists regimenes_fiscales_tipo_persona_check;

alter table public.regimenes_fiscales
  add constraint regimenes_fiscales_tipo_persona_check
  check (tipo_persona in ('fisica', 'moral', 'mixta'));

alter table public.regimenes_fiscales
  drop constraint if exists regimenes_fiscales_vigencia_check;

alter table public.regimenes_fiscales
  add constraint regimenes_fiscales_vigencia_check
  check (vigencia_hasta is null or vigencia_desde is null or vigencia_hasta >= vigencia_desde);

-- Clasificación inicial del catálogo que ya utiliza Fiscalix.
update public.regimenes_fiscales
set tipo_persona = case
    when clave_sat in ('605','606','608','611','612','614','615','616','621','625','626') then 'fisica'
    when clave_sat in ('601','603','620','622','623','624') then 'moral'
    else 'mixta'
  end,
  activo = true,
  seleccionable_nuevo = case when clave_sat = '621' then false else true end,
  updated_at = now();

alter table public.empresa_fiscal
  add column if not exists usuario_id varchar references public.usuarios(id) on delete restrict,
  add column if not exists tipo_persona text not null default 'fisica',
  add column if not exists fecha_inicio date,
  add column if not exists fecha_fin date,
  add column if not exists periodicidad text,
  add column if not exists activo boolean not null default true,
  add column if not exists creado_por varchar references public.usuarios(id) on delete set null,
  add column if not exists actualizado_por varchar references public.usuarios(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Vincula registros históricos existentes con uno de los usuarios que ya tiene
-- acceso a la empresa. No inventa usuarios ni empresas.
with primary_membership as (
  select distinct on (eu.empresa_id)
    eu.empresa_id,
    eu.usuario_id
  from public.empresa_usuario eu
  where eu.empresa_id is not null
    and eu.usuario_id is not null
  order by eu.empresa_id, eu.usuario_id
)
update public.empresa_fiscal ef
set usuario_id = membership.usuario_id,
    creado_por = coalesce(ef.creado_por, membership.usuario_id),
    actualizado_por = coalesce(ef.actualizado_por, membership.usuario_id),
    fecha_inicio = coalesce(ef.fecha_inicio, current_date)
from primary_membership membership
where membership.empresa_id = ef.empresa_id
  and ef.usuario_id is null;

update public.empresa_fiscal
set fecha_inicio = coalesce(fecha_inicio, current_date),
    tipo_persona = 'fisica',
    updated_at = now();

alter table public.empresa_fiscal
  alter column fecha_inicio set default current_date;

alter table public.empresa_fiscal
  drop constraint if exists empresa_fiscal_tipo_persona_check;

alter table public.empresa_fiscal
  add constraint empresa_fiscal_tipo_persona_check
  check (tipo_persona = 'fisica');

alter table public.empresa_fiscal
  drop constraint if exists empresa_fiscal_vigencia_check;

alter table public.empresa_fiscal
  add constraint empresa_fiscal_vigencia_check
  check (fecha_fin is null or fecha_fin >= fecha_inicio);

create index if not exists empresa_fiscal_usuario_idx
  on public.empresa_fiscal (usuario_id);

create index if not exists empresa_fiscal_regimen_idx
  on public.empresa_fiscal (regimen_id);

create index if not exists empresa_fiscal_vigencia_idx
  on public.empresa_fiscal (empresa_id, fecha_inicio, fecha_fin);

create table if not exists public.empresa_fiscal_historial (
  id uuid primary key default gen_random_uuid(),
  empresa_fiscal_id uuid,
  empresa_id uuid,
  usuario_id varchar,
  regimen_id uuid,
  operacion text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  actor_usuario_id varchar,
  created_at timestamptz not null default now()
);

create index if not exists empresa_fiscal_historial_empresa_idx
  on public.empresa_fiscal_historial (empresa_id, created_at desc);

create index if not exists empresa_fiscal_historial_perfil_idx
  on public.empresa_fiscal_historial (empresa_fiscal_id, created_at desc);

create or replace function public.registrar_historial_empresa_fiscal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.empresa_fiscal_historial (
      empresa_fiscal_id, empresa_id, usuario_id, regimen_id, operacion,
      datos_anteriores, datos_nuevos, actor_usuario_id
    ) values (
      new.id, new.empresa_id, new.usuario_id, new.regimen_id, tg_op,
      null, to_jsonb(new), coalesce(new.actualizado_por, new.creado_por)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.empresa_fiscal_historial (
      empresa_fiscal_id, empresa_id, usuario_id, regimen_id, operacion,
      datos_anteriores, datos_nuevos, actor_usuario_id
    ) values (
      new.id, new.empresa_id, new.usuario_id, new.regimen_id, tg_op,
      to_jsonb(old), to_jsonb(new), coalesce(new.actualizado_por, new.creado_por)
    );
    return new;
  else
    insert into public.empresa_fiscal_historial (
      empresa_fiscal_id, empresa_id, usuario_id, regimen_id, operacion,
      datos_anteriores, datos_nuevos, actor_usuario_id
    ) values (
      old.id, old.empresa_id, old.usuario_id, old.regimen_id, tg_op,
      to_jsonb(old), null, coalesce(old.actualizado_por, old.creado_por)
    );
    return old;
  end if;
end;
$$;

drop trigger if exists empresa_fiscal_historial_trigger on public.empresa_fiscal;
create trigger empresa_fiscal_historial_trigger
after insert or update or delete on public.empresa_fiscal
for each row execute function public.registrar_historial_empresa_fiscal();

create or replace function public.actualizar_updated_at_fiscal()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists regimenes_fiscales_updated_at_trigger on public.regimenes_fiscales;
create trigger regimenes_fiscales_updated_at_trigger
before update on public.regimenes_fiscales
for each row execute function public.actualizar_updated_at_fiscal();

drop trigger if exists empresa_fiscal_updated_at_trigger on public.empresa_fiscal;
create trigger empresa_fiscal_updated_at_trigger
before update on public.empresa_fiscal
for each row execute function public.actualizar_updated_at_fiscal();

-- Los clientes usan Firebase, no Supabase Auth. Por ello las tablas se cierran
-- al acceso directo y se consumen exclusivamente desde el backend con service role.
alter table public.regimenes_fiscales enable row level security;
alter table public.empresa_fiscal enable row level security;
alter table public.empresa_fiscal_historial enable row level security;

revoke all on table public.regimenes_fiscales from anon, authenticated;
revoke all on table public.empresa_fiscal from anon, authenticated;
revoke all on table public.empresa_fiscal_historial from anon, authenticated;

commit;

-- Comprobaciones de lectura recomendadas después de ejecutar el script:
-- select clave_sat,nombre,tipo_persona,activo,seleccionable_nuevo
-- from public.regimenes_fiscales order by clave_sat;
--
-- select id,empresa_id,usuario_id,regimen_id,fecha_inicio,fecha_fin,activo
-- from public.empresa_fiscal order by empresa_id;
