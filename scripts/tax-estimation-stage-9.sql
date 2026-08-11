-- Etapa 9: habilita auditoria de estimaciones solicitadas desde Mobile.
begin;

alter table public.estimaciones_fiscales_ejecuciones
  drop constraint if exists estimaciones_fiscales_ejecuciones_canal_check;

alter table public.estimaciones_fiscales_ejecuciones
  add constraint estimaciones_fiscales_ejecuciones_canal_check
  check (canal in ('web', 'api', 'mobile'));

create index if not exists estimaciones_fiscales_ejecuciones_usuario_periodo_canal_idx
  on public.estimaciones_fiscales_ejecuciones (
    usuario_id,
    periodo_clave,
    canal,
    created_at desc
  );

commit;
