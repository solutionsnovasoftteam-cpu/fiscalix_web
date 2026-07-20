export const USER_ROLES = {
  ADMIN: "administrador",
  CLIENT: "cliente_fiscalix",
  SUPER_ADMIN: "superadministrador",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const DEFAULT_USER_ROLE: UserRole = USER_ROLES.CLIENT;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  administrador: "Administrador",
  cliente_fiscalix: "Cliente de Fiscalix",
  superadministrador: "Superadministrador",
};

const validRoles = new Set<string>(Object.values(USER_ROLES));

export function normalizeUserRole(value: unknown): UserRole {
  if (typeof value !== "string") return DEFAULT_USER_ROLE;
  return validRoles.has(value) ? (value as UserRole) : DEFAULT_USER_ROLE;
}

export function roleLabel(value: unknown) {
  return USER_ROLE_LABELS[normalizeUserRole(value)];
}

export function isAdminRole(value: unknown) {
  const role = normalizeUserRole(value);
  return role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;
}

export function isSuperAdminRole(value: unknown) {
  return normalizeUserRole(value) === USER_ROLES.SUPER_ADMIN;
}

export function canManagePlans(user: { rol?: unknown } | null | undefined) {
  return isSuperAdminRole(user?.rol);
}

export function canViewAdminDashboard(user: { rol?: unknown } | null | undefined) {
  return isAdminRole(user?.rol);
}

export function canManageAdminUsers(user: { rol?: unknown } | null | undefined) {
  return isSuperAdminRole(user?.rol);
}

export function canSuspendUserAccounts(user: { rol?: unknown } | null | undefined) {
  return isAdminRole(user?.rol);
}

export function canTargetUserRole(actorRole: unknown, targetRole: unknown) {
  const actor = normalizeUserRole(actorRole);
  const target = normalizeUserRole(targetRole);

  if (actor === USER_ROLES.ADMIN) return target === USER_ROLES.CLIENT;
  if (actor === USER_ROLES.SUPER_ADMIN) return target === USER_ROLES.CLIENT || target === USER_ROLES.ADMIN;
  return false;
}
