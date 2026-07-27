-- Permite ligar ingresos independientes al usuario que los registró.
-- Úsalo si Supabase muestra que falta la columna usuario_id en public.ingresos.

alter table public.ingresos
  add column if not exists usuario_id text,
  alter column empresa_id drop not null;

create index if not exists ingresos_usuario_id_idx
on public.ingresos (usuario_id);

update public.ingresos i
set usuario_id = eu.usuario_id
from public.empresa_usuario eu
where i.usuario_id is null
  and i.empresa_id = eu.empresa_id;
