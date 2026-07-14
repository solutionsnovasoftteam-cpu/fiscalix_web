insert into public.roles (nombre, descripcion)
select 'cliente_fiscalix', 'Cliente que contrató Fiscalix y puede consultar/operar su cuenta.'
where not exists (
  select 1 from public.roles where nombre = 'cliente_fiscalix'
);

insert into public.roles (nombre, descripcion)
select 'administrador', 'Administrador de Fiscalix con permisos de gestión operativa.'
where not exists (
  select 1 from public.roles where nombre = 'administrador'
);

insert into public.roles (nombre, descripcion)
select 'superadministrador', 'Superadministrador con acceso completo a la configuración de Fiscalix.'
where not exists (
  select 1 from public.roles where nombre = 'superadministrador'
);

delete from public.usuario_rol
where usuario_id in (
  select id
  from public.usuarios
  where lower(correo) in ('uriel@fiscalix.com', 'arm@nova.com', 'juan@lasc.com')
);

insert into public.usuario_rol (usuario_id, rol_id)
select usuarios.id, roles.id
from public.usuarios
cross join public.roles
where lower(usuarios.correo) = 'uriel@fiscalix.com'
  and roles.nombre = 'superadministrador';

insert into public.usuario_rol (usuario_id, rol_id)
select usuarios.id, roles.id
from public.usuarios
cross join public.roles
where lower(usuarios.correo) = 'arm@nova.com'
  and roles.nombre = 'administrador';

insert into public.usuario_rol (usuario_id, rol_id)
select usuarios.id, roles.id
from public.usuarios
cross join public.roles
where lower(usuarios.correo) = 'juan@lasc.com'
  and roles.nombre = 'cliente_fiscalix';

insert into public.usuario_rol (usuario_id, rol_id)
select usuarios.id, roles.id
from public.usuarios
cross join public.roles
where roles.nombre = 'cliente_fiscalix'
  and not exists (
    select 1
    from public.usuario_rol
    where usuario_rol.usuario_id = usuarios.id
  );
