import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envFile = readFileSync(".env.local", "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    process.env[key.trim()] = rawValue;
  }
}

loadLocalEnv();

const superAdminEmail = process.argv[2]?.trim().toLowerCase() ?? "uriel@fiscalix.com";

const roles = [
  {
    descripcion: "Cliente que contrató Fiscalix y puede consultar/operar su cuenta.",
    nombre: "cliente_fiscalix",
  },
  {
    descripcion: "Administrador de Fiscalix con permisos de gestión operativa.",
    nombre: "administrador",
  },
  {
    descripcion: "Superadministrador con acceso completo a la configuración de Fiscalix.",
    nombre: "superadministrador",
  },
];

const assignments = [
  { correo: superAdminEmail, rol: "superadministrador" },
  { correo: "arm@nova.com", rol: "administrador" },
  { correo: "juan@lasc.com", rol: "cliente_fiscalix" },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function ensureRole(role) {
  const { data: existing, error: findError } = await supabase
    .from("roles")
    .select("id,nombre")
    .eq("nombre", role.nombre)
    .maybeSingle();

  if (findError) throw new Error(`No se pudo consultar el rol ${role.nombre}: ${findError.message}`);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("roles")
    .insert(role)
    .select("id,nombre")
    .single();

  if (error) throw new Error(`No se pudo crear el rol ${role.nombre}: ${error.message}`);
  return data;
}

const roleRows = new Map();
for (const role of roles) {
  const row = await ensureRole(role);
  roleRows.set(row.nombre, row);
}

const updated = [];

for (const assignment of assignments) {
  const { data: user, error: userError } = await supabase
    .from("usuarios")
    .select("id,nombre,apellido,correo")
    .eq("correo", assignment.correo)
    .maybeSingle();

  if (userError) throw new Error(`No se pudo consultar ${assignment.correo}: ${userError.message}`);
  if (!user) {
    updated.push({ correo: assignment.correo, encontrado: false, rol: assignment.rol });
    continue;
  }

  const role = roleRows.get(assignment.rol);

  const { error: deleteError } = await supabase
    .from("usuario_rol")
    .delete()
    .eq("usuario_id", user.id);

  if (deleteError) throw new Error(`No se pudieron limpiar roles de ${assignment.correo}: ${deleteError.message}`);

  const { error: insertError } = await supabase
    .from("usuario_rol")
    .insert({
      rol_id: role.id,
      usuario_id: user.id,
    });

  if (insertError) throw new Error(`No se pudo asignar ${assignment.rol} a ${assignment.correo}: ${insertError.message}`);

  updated.push({ ...user, encontrado: true, rol: assignment.rol });
}

const clientRole = roleRows.get("cliente_fiscalix");
const { data: allUsers, error: allUsersError } = await supabase
  .from("usuarios")
  .select("id,nombre,apellido,correo");

if (allUsersError) throw new Error(`No se pudieron consultar usuarios sin rol: ${allUsersError.message}`);

const { data: currentRelations, error: relationsError } = await supabase
  .from("usuario_rol")
  .select("usuario_id");

if (relationsError) throw new Error(`No se pudieron consultar relaciones usuario_rol: ${relationsError.message}`);

const usersWithRole = new Set((currentRelations ?? []).map((relation) => relation.usuario_id));
const missingRoleUsers = (allUsers ?? []).filter((user) => !usersWithRole.has(user.id));

if (missingRoleUsers.length) {
  const { error } = await supabase
    .from("usuario_rol")
    .insert(missingRoleUsers.map((user) => ({
      rol_id: clientRole.id,
      usuario_id: user.id,
    })));

  if (error) throw new Error(`No se pudieron asignar roles cliente por defecto: ${error.message}`);
}

console.log(JSON.stringify({
  asignaciones_directas: updated,
  clientes_asignados_por_defecto: missingRoleUsers.length,
}, null, 2));
