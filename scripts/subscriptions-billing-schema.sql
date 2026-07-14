alter table public.suscripciones
add column if not exists estado varchar(40) not null default 'activa',
add column if not exists estado_pago varchar(60) not null default 'proxima_a_pagar',
add column if not exists fecha_inicio date default current_date,
add column if not exists fecha_proxima_facturacion date,
add column if not exists fecha_ultimo_pago date,
add column if not exists monto_mensual numeric(12,2),
add column if not exists notas_facturacion text;

alter table public.suscripciones
drop constraint if exists suscripciones_estado_check;

alter table public.suscripciones
add constraint suscripciones_estado_check
check (estado in ('activa', 'suspendida', 'cancelada'));

alter table public.suscripciones
drop constraint if exists suscripciones_estado_pago_check;

alter table public.suscripciones
add constraint suscripciones_estado_pago_check
check (estado_pago in (
  'proxima_a_pagar',
  'pago_no_acreditado',
  'pagado_exito_mes',
  'revision_manual'
));

create index if not exists suscripciones_empresa_id_idx
on public.suscripciones (empresa_id);

create index if not exists suscripciones_estado_pago_idx
on public.suscripciones (estado_pago);
