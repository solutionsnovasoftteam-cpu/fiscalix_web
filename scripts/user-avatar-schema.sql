-- Foto de perfil de usuarios de Fiscalix.
-- Este script se puede ejecutar varias veces de forma segura.

alter table public.usuarios
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on column public.usuarios.avatar_url is
  'URL pública de la fotografía de perfil almacenada en el bucket avatars.';

-- La aplicación realiza altas, reemplazos y eliminaciones mediante su API
-- autenticada y SUPABASE_SERVICE_ROLE_KEY. No se crean políticas públicas de
-- escritura para impedir que el navegador modifique archivos directamente.
