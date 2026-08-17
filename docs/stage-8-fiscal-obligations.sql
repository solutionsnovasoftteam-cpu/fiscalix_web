-- Fiscalix Stage 8: persisted fiscal obligation instances.
-- Execute this migration in the Supabase SQL editor before deploying the API route.

create table if not exists public.empresa_obligacion_periodo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sugerencia_id uuid not null references public.regimen_obligacion_sugerida(id) on delete restrict,
  periodo_clave varchar(10) not null,
  fecha_vencimiento date not null,
  estado varchar(20) not null default 'pendiente'
    check (estado in ('pendiente', 'completada')),
  completada_at timestamptz null,
  completada_por varchar null references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, sugerencia_id, periodo_clave)
);

create index if not exists empresa_obligacion_periodo_empresa_vencimiento_idx
  on public.empresa_obligacion_periodo (empresa_id, fecha_vencimiento);

create index if not exists empresa_obligacion_periodo_estado_idx
  on public.empresa_obligacion_periodo (estado, fecha_vencimiento);

-- The API owns writes through the service-role client. Enable RLS for direct-client safety.
alter table public.empresa_obligacion_periodo enable row level security;
