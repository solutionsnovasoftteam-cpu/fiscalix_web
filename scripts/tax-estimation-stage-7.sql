-- Fiscalix - Etapa 7: trazabilidad de estimaciones fiscales.
-- Ejecutar despues de scripts/financial-movements-stage-5.sql.

begin;

create extension if not exists pgcrypto;

create table if not exists public.reglas_fiscales_versiones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  version text not null,
  regimen_clave_sat text not null,
  nombre text not null,
  descripcion text,
  formula jsonb not null default '{}'::jsonb,
  variables jsonb not null default '{}'::jsonb,
  fuente text,
  activo boolean not null default true,
  vigencia_desde date,
  vigencia_hasta date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vigencia_hasta is null or vigencia_desde is null or vigencia_hasta >= vigencia_desde)
);

create table if not exists public.estimaciones_fiscales_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id varchar not null references public.usuarios(id) on delete restrict,
  empresa_id uuid references public.empresas(id) on delete set null,
  periodo_clave text not null,
  periodo_inicio date not null,
  periodo_fin date not null,
  regimen_clave_sat text not null,
  regla_version_id uuid references public.reglas_fiscales_versiones(id) on delete set null,
  regla_clave text not null,
  regla_version text not null,
  fuente_datos text not null,
  canal text not null default 'web' check (canal in ('web', 'api')),
  parametros jsonb not null default '{}'::jsonb,
  variables jsonb not null default '{}'::jsonb,
  formula_aplicada jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  total_ingresos numeric(14, 2) not null default 0,
  total_gastos numeric(14, 2) not null default 0,
  base_fiscal numeric(14, 2) not null default 0,
  iva_estimado numeric(14, 2) not null default 0,
  isr_estimado numeric(14, 2) not null default 0,
  impuesto_estimado numeric(14, 2) not null default 0,
  movimientos_total integer not null default 0,
  movimientos_considerados integer not null default 0,
  movimientos_excluidos integer not null default 0,
  created_at timestamptz not null default now(),
  check (periodo_fin >= periodo_inicio),
  check (movimientos_total >= 0 and movimientos_considerados >= 0 and movimientos_excluidos >= 0)
);

create table if not exists public.estimaciones_fiscales_movimientos (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references public.estimaciones_fiscales_ejecuciones(id) on delete cascade,
  movimiento_id uuid not null,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  empresa_id uuid references public.empresas(id) on delete set null,
  estado text,
  considerado boolean not null default false,
  razon_exclusion text,
  monto numeric(14, 2) not null default 0,
  base_fiscal numeric(14, 2) not null default 0,
  iva_monto numeric(14, 2) not null default 0,
  isr_retenido_monto numeric(14, 2) not null default 0,
  deducible boolean,
  fecha_movimiento date,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.reglas_fiscales_versiones (
  clave,
  version,
  regimen_clave_sat,
  nombre,
  descripcion,
  formula,
  variables,
  fuente,
  activo
) values (
  'RESICO_MX_PF_MONTHLY_V1',
  '1.0.0',
  '626',
  'Régimen Simplificado de Confianza',
  'ISR RESICO mensual + IVA trasladado menos acreditable sobre movimientos normalizados.',
  '{
    "baseResico": "sum(ingresos.cobrados.base_fiscal)",
    "isrDetermined": "baseResico * tasaResicoMensual",
    "isrEstimated": "max(0, isrDetermined - isrRetenido)",
    "vatEstimated": "max(0, ivaTrasladado - ivaAcreditable)",
    "taxEstimated": "isrEstimated + vatEstimated"
  }'::jsonb,
  '{
    "source": "movimientos_fiscales_normalizados",
    "rates": [
      { "maxIncome": 25000, "rate": 0.0100 },
      { "maxIncome": 50000, "rate": 0.0110 },
      { "maxIncome": 83333.33, "rate": 0.0150 },
      { "maxIncome": 208333.33, "rate": 0.0200 },
      { "maxIncome": 3500000, "rate": 0.0250 }
    ]
  }'::jsonb,
  'Fiscalix Etapa 6/7',
  true
)
on conflict (clave) do update set
  version = excluded.version,
  regimen_clave_sat = excluded.regimen_clave_sat,
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  formula = excluded.formula,
  variables = excluded.variables,
  fuente = excluded.fuente,
  activo = excluded.activo,
  updated_at = now();

create index if not exists reglas_fiscales_clave_idx
  on public.reglas_fiscales_versiones (clave);

create index if not exists estimaciones_fiscales_usuario_fecha_idx
  on public.estimaciones_fiscales_ejecuciones (usuario_id, created_at desc);

create index if not exists estimaciones_fiscales_empresa_periodo_idx
  on public.estimaciones_fiscales_ejecuciones (empresa_id, periodo_clave, created_at desc);

create index if not exists estimaciones_fiscales_periodo_idx
  on public.estimaciones_fiscales_ejecuciones (periodo_clave, created_at desc);

create index if not exists estimaciones_movimientos_ejecucion_idx
  on public.estimaciones_fiscales_movimientos (ejecucion_id);

create index if not exists estimaciones_movimientos_movimiento_idx
  on public.estimaciones_fiscales_movimientos (movimiento_id);

alter table public.reglas_fiscales_versiones enable row level security;
alter table public.estimaciones_fiscales_ejecuciones enable row level security;
alter table public.estimaciones_fiscales_movimientos enable row level security;

revoke all on table public.reglas_fiscales_versiones from anon, authenticated;
revoke all on table public.estimaciones_fiscales_ejecuciones from anon, authenticated;
revoke all on table public.estimaciones_fiscales_movimientos from anon, authenticated;

notify pgrst, 'reload schema';

commit;
