begin;

create extension if not exists pgcrypto;

create table if not exists public.analisis_financieros_ia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id varchar not null references public.usuarios(id) on delete cascade,
  periodo_clave varchar(7) not null check (periodo_clave ~ '^\d{4}-\d{2}$'),
  analisis jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, periodo_clave)
);

create index if not exists analisis_financieros_ia_empresa_periodo_idx
  on public.analisis_financieros_ia (empresa_id, periodo_clave, updated_at desc);

alter table public.analisis_financieros_ia enable row level security;
revoke all on table public.analisis_financieros_ia from anon, authenticated;

commit;
