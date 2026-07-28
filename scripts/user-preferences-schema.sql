create table if not exists public.usuario_preferencias (
  usuario_id varchar primary key references public.usuarios(id) on delete cascade,
  moneda varchar(3) not null default 'MXN',
  zona_horaria varchar(80) not null default 'America/Mexico_City',
  idioma varchar(16) not null default 'es',
  formato_fecha varchar(16) not null default 'DD/MM/YYYY',
  formato_hora varchar(16) not null default '24h',
  tema varchar(16) not null default 'dark',
  actualizado_en timestamptz not null default now(),
  constraint usuario_preferencias_moneda_chk check (moneda in ('MXN', 'USD', 'EUR')),
  constraint usuario_preferencias_idioma_chk check (idioma in ('es', 'en')),
  constraint usuario_preferencias_formato_fecha_chk check (formato_fecha in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  constraint usuario_preferencias_formato_hora_chk check (formato_hora in ('24h', '12h')),
  constraint usuario_preferencias_tema_chk check (tema in ('dark', 'light')),
  constraint usuario_preferencias_zona_horaria_chk check (zona_horaria in ('America/Mexico_City', 'America/Tijuana', 'America/Cancun'))
);

insert into public.usuario_preferencias (usuario_id)
select usuarios.id
from public.usuarios
where not exists (
  select 1
  from public.usuario_preferencias
  where usuario_preferencias.usuario_id = usuarios.id
);
