-- Permite registrar gastos sin asociarlos a una empresa de Fiscalix.
-- El gasto queda ligado al usuario que lo registró mediante usuario_id.

alter table public.gastos
  add column if not exists usuario_id text,
  alter column empresa_id drop not null;

create index if not exists gastos_usuario_id_idx
on public.gastos (usuario_id);

create index if not exists gastos_fecha_gasto_idx
on public.gastos (fecha_gasto);

-- Para registros históricos ligados a empresas, intenta asignar un usuario relacionado.
-- Si una empresa tiene varios usuarios, PostgreSQL puede elegir cualquiera de las relaciones
-- encontradas; ajusta manualmente los casos donde necesites ownership específico.
update public.gastos g
set usuario_id = eu.usuario_id
from public.empresa_usuario eu
where g.usuario_id is null
  and g.empresa_id = eu.empresa_id;

-- Ayuda a que PostgREST/Supabase refresque la caché del esquema después del ALTER TABLE.
notify pgrst, 'reload schema';
