-- Ejecutar en Supabase SQL Editor para que Nómina lea y guarde datos reales.
-- El seed scripts/seed-armando-admin-demo.mjs llenará estas tablas si existen.

create table if not exists public.empleados_nomina (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  nombre varchar(180) not null,
  puesto varchar(160),
  departamento varchar(160),
  sueldo_mensual numeric(12,2) not null default 0,
  estado varchar(30) not null default 'activo',
  fecha_alta date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.nominas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  folio varchar(120) not null,
  periodo varchar(180),
  fecha_pago date,
  empleados integer not null default 0,
  percepciones numeric(12,2) not null default 0,
  deducciones numeric(12,2) not null default 0,
  total_pagado numeric(12,2) not null default 0,
  estado varchar(30) not null default 'borrador',
  descargado boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists empleados_nomina_empresa_nombre_idx
  on public.empleados_nomina (empresa_id, nombre);

create unique index if not exists nominas_empresa_folio_idx
  on public.nominas (empresa_id, folio);
