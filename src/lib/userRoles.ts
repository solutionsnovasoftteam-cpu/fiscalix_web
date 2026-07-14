import "server-only";

import { DEFAULT_USER_ROLE, normalizeUserRole, USER_ROLES, type UserRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type RoleJoinRow = {
  roles: { nombre: string | null } | { nombre: string | null }[] | null;
};

const rolePriority: Record<UserRole, number> = {
  administrador: 2,
  cliente_fiscalix: 1,
  superadministrador: 3,
};

function getRoleNamesFromJoin(row: RoleJoinRow) {
  if (!row.roles) return [];
  const roles = Array.isArray(row.roles) ? row.roles : [row.roles];
  return roles.map((role) => role.nombre).filter(Boolean);
}

export function pickHighestRole(values: unknown[]) {
  const roles = values.map(normalizeUserRole);
  return roles.reduce<UserRole>((highest, current) => {
    return rolePriority[current] > rolePriority[highest] ? current : highest;
  }, DEFAULT_USER_ROLE);
}

export async function getUserRoleByUserId(userId: string): Promise<UserRole> {
  const { data, error } = await supabase
    .from("usuario_rol")
    .select("roles(nombre)")
    .eq("usuario_id", userId);

  if (error || !data?.length) return DEFAULT_USER_ROLE;

  const roleNames = (data as unknown as RoleJoinRow[]).flatMap(getRoleNamesFromJoin);
  return pickHighestRole(roleNames);
}

export async function getRoleIdByName(role: UserRole) {
  const { data, error } = await supabase
    .from("roles")
    .select("id")
    .eq("nombre", role)
    .maybeSingle();

  if (error || !data) return null;
  return data.id as string;
}

export async function assignDefaultRoleToUser(userId: string) {
  const roleId = await getRoleIdByName(USER_ROLES.CLIENT);
  if (!roleId) return;

  const { data: existing } = await supabase
    .from("usuario_rol")
    .select("id")
    .eq("usuario_id", userId)
    .eq("rol_id", roleId)
    .maybeSingle();

  if (existing) return;

  await supabase.from("usuario_rol").insert({
    rol_id: roleId,
    usuario_id: userId,
  });
}
