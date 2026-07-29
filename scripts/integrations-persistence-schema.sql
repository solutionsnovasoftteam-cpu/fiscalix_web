alter table public.integraciones
add column if not exists auto_sync boolean not null default false,
add column if not exists ultima_sincronizacion timestamptz,
add column if not exists actualizado_en timestamptz not null default now();

comment on column public.integraciones.auto_sync is 'Control visual/persistente de sincronización automática en Fiscalix.';
comment on column public.integraciones.ultima_sincronizacion is 'Fecha de la última sincronización simulada o real de la integración.';
comment on column public.integraciones.actualizado_en is 'Fecha de última actualización del registro de integración.';
