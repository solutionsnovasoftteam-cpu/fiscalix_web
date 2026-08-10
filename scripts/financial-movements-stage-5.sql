
begin;

alter table public.ingresos
  add column if not exists usuario_id text,
  add column if not exists estado text,
  add column if not exists deducible boolean,
  add column if not exists base_fiscal numeric(14, 2),
  add column if not exists iva_tasa numeric(7, 6),
  add column if not exists iva_monto numeric(14, 2),
  add column if not exists isr_retenido_monto numeric(14, 2);

alter table public.gastos
  add column if not exists usuario_id text,
  add column if not exists estado text,
  add column if not exists deducible boolean,
  add column if not exists base_fiscal numeric(14, 2),
  add column if not exists iva_tasa numeric(7, 6),
  add column if not exists iva_monto numeric(14, 2),
  add column if not exists isr_retenido_monto numeric(14, 2);

update public.ingresos i
set usuario_id = eu.usuario_id
from public.empresa_usuario eu
where i.usuario_id is null
  and i.empresa_id = eu.empresa_id;

update public.gastos g
set usuario_id = eu.usuario_id
from public.empresa_usuario eu
where g.usuario_id is null
  and g.empresa_id = eu.empresa_id;

update public.ingresos
set
  estado = coalesce(estado, 'cobrado'),
  deducible = coalesce(deducible, false),
  base_fiscal = coalesce(base_fiscal, monto, 0),
  iva_tasa = coalesce(iva_tasa, 0.160000),
  iva_monto = coalesce(iva_monto, round(coalesce(monto, 0)::numeric * 0.160000, 2)),
  isr_retenido_monto = coalesce(isr_retenido_monto, 0);

update public.gastos
set
  estado = coalesce(estado, 'pagado'),
  deducible = coalesce(deducible, true),
  base_fiscal = coalesce(base_fiscal, monto, 0),
  iva_tasa = coalesce(iva_tasa, 0.160000),
  iva_monto = coalesce(iva_monto, round(coalesce(monto, 0)::numeric * 0.160000, 2)),
  isr_retenido_monto = coalesce(isr_retenido_monto, 0);

alter table public.ingresos
  alter column estado set default 'cobrado',
  alter column estado set not null,
  alter column deducible set default false,
  alter column deducible set not null,
  alter column base_fiscal set default 0,
  alter column base_fiscal set not null,
  alter column iva_tasa set default 0.160000,
  alter column iva_tasa set not null,
  alter column iva_monto set default 0,
  alter column iva_monto set not null,
  alter column isr_retenido_monto set default 0,
  alter column isr_retenido_monto set not null;

alter table public.gastos
  alter column estado set default 'pagado',
  alter column estado set not null,
  alter column deducible set default true,
  alter column deducible set not null,
  alter column base_fiscal set default 0,
  alter column base_fiscal set not null,
  alter column iva_tasa set default 0.160000,
  alter column iva_tasa set not null,
  alter column iva_monto set default 0,
  alter column iva_monto set not null,
  alter column isr_retenido_monto set default 0,
  alter column isr_retenido_monto set not null;

alter table public.ingresos
  drop constraint if exists ingresos_estado_movimiento_check,
  add constraint ingresos_estado_movimiento_check
    check (estado in ('cobrado', 'pendiente', 'cancelado')),
  drop constraint if exists ingresos_contexto_fiscal_check,
  add constraint ingresos_contexto_fiscal_check
    check (usuario_id is not null and empresa_id is not null and categoria_id is not null) not valid,
  drop constraint if exists ingresos_impuestos_no_negativos_check,
  add constraint ingresos_impuestos_no_negativos_check
    check (base_fiscal >= 0 and iva_tasa >= 0 and iva_tasa <= 1 and iva_monto >= 0 and isr_retenido_monto >= 0);

alter table public.gastos
  drop constraint if exists gastos_estado_movimiento_check,
  add constraint gastos_estado_movimiento_check
    check (estado in ('pagado', 'pendiente', 'cancelado')),
  drop constraint if exists gastos_contexto_fiscal_check,
  add constraint gastos_contexto_fiscal_check
    check (usuario_id is not null and empresa_id is not null and categoria_id is not null) not valid,
  drop constraint if exists gastos_impuestos_no_negativos_check,
  add constraint gastos_impuestos_no_negativos_check
    check (base_fiscal >= 0 and iva_tasa >= 0 and iva_tasa <= 1 and iva_monto >= 0 and isr_retenido_monto >= 0);

create index if not exists ingresos_empresa_estado_fecha_idx
on public.ingresos (empresa_id, estado, fecha_ingreso);

create index if not exists ingresos_usuario_empresa_idx
on public.ingresos (usuario_id, empresa_id);

create index if not exists gastos_empresa_estado_fecha_idx
on public.gastos (empresa_id, estado, fecha_gasto);

create index if not exists gastos_usuario_empresa_idx
on public.gastos (usuario_id, empresa_id);

create or replace view public.movimientos_fiscales_normalizados as
select
  i.id,
  'ingreso'::text as tipo,
  i.usuario_id,
  i.empresa_id,
  i.categoria_id,
  i.concepto,
  i.fecha_ingreso as fecha_movimiento,
  i.estado,
  i.deducible,
  i.monto,
  i.base_fiscal,
  i.iva_tasa,
  i.iva_monto,
  i.isr_retenido_monto,
  (i.estado <> 'cancelado' and i.usuario_id is not null and i.empresa_id is not null and i.categoria_id is not null) as activo_fiscal
from public.ingresos i
union all
select
  g.id,
  'gasto'::text as tipo,
  g.usuario_id,
  g.empresa_id,
  g.categoria_id,
  g.concepto,
  g.fecha_gasto as fecha_movimiento,
  g.estado,
  g.deducible,
  g.monto,
  g.base_fiscal,
  g.iva_tasa,
  g.iva_monto,
  g.isr_retenido_monto,
  (g.estado <> 'cancelado' and g.usuario_id is not null and g.empresa_id is not null and g.categoria_id is not null) as activo_fiscal
from public.gastos g;

comment on view public.movimientos_fiscales_normalizados is
  'Fuente unificada de ingresos y gastos con contexto fiscal mínimo para motores de cálculo.';

notify pgrst, 'reload schema';

commit;
