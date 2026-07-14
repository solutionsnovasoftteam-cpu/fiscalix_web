import "server-only";

import { canTargetUserRole, roleLabel, type UserRole } from "@/lib/roles";
import { pickHighestRole } from "@/lib/userRoles";
import { supabase } from "@/lib/supabase";

export type AdminDashboardUser = {
  apellido: string | null;
  billingAmount: number | null;
  billingNotes: string | null;
  billingStatus: string;
  billingStatusLabel: string;
  companyName: string | null;
  correo: string;
  estado: string | null;
  fechaRegistro: string | null;
  id: string;
  nombre: string;
  nextBillingDate: string | null;
  planName: string | null;
  rol: UserRole;
  rolLabel: string;
  subscriptionStatus: string | null;
  telefono: string | null;
};

type UserRow = {
  apellido: string | null;
  correo: string;
  estado: string | null;
  fecha_registro: string | null;
  id: string;
  nombre: string;
  telefono: string | null;
};

type RoleJoinRow = {
  roles: { nombre: string | null } | { nombre: string | null }[] | null;
  usuario_id: string | null;
};

type CompanyJoinRow = {
  empresas: { estado: string | null; id: string; nombre_comercial: string | null; rfc: string | null } | { estado: string | null; id: string; nombre_comercial: string | null; rfc: string | null }[] | null;
  usuario_id: string | null;
};

type SubscriptionRow = {
  empresa_id: string | null;
  estado?: string | null;
  estado_pago?: string | null;
  fecha_proxima_facturacion?: string | null;
  monto_mensual?: number | string | null;
  notas_facturacion?: string | null;
  planes: { nombre: string | null; precio_mensual: number | string | null } | { nombre: string | null; precio_mensual: number | string | null }[] | null;
};

const basicSubscriptionSelect = "empresa_id,planes(nombre,precio_mensual)";
const extendedSubscriptionSelect = [
  "empresa_id",
  "estado",
  "estado_pago",
  "fecha_proxima_facturacion",
  "monto_mensual",
  "notas_facturacion",
  "planes(nombre,precio_mensual)",
].join(",");

const billingLabels: Record<string, string> = {
  pago_no_acreditado: "Pago no acreditado",
  pagado_exito_mes: "Pagado con éxito este mes",
  proxima_a_pagar: "Próxima a pagar",
  revision_manual: "Revisión manual",
  sin_datos: "Sin datos de facturación",
};

function getRoleNames(row: RoleJoinRow) {
  if (!row.roles) return [];
  const roles = Array.isArray(row.roles) ? row.roles : [row.roles];
  return roles.map((role) => role.nombre).filter((name): name is string => Boolean(name));
}

function getFirstCompany(row: CompanyJoinRow) {
  if (!row.empresas) return null;
  return Array.isArray(row.empresas) ? row.empresas[0] ?? null : row.empresas;
}

function getFirstPlan(row: SubscriptionRow) {
  if (!row.planes) return null;
  return Array.isArray(row.planes) ? row.planes[0] ?? null : row.planes;
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissingBillingColumnError(error: { code?: string; details?: string; message?: string } | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst204") || text.includes("schema cache") || text.includes("estado_pago") || text.includes("fecha_proxima_facturacion");
}

async function listSubscriptions() {
  let result = await supabase
    .from("suscripciones")
    .select(extendedSubscriptionSelect) as unknown as {
      data: SubscriptionRow[] | null;
      error: { code?: string; details?: string; message: string } | null;
    };

  if (result.error && isMissingBillingColumnError(result.error)) {
    result = await supabase
      .from("suscripciones")
      .select(basicSubscriptionSelect) as unknown as {
        data: SubscriptionRow[] | null;
        error: { code?: string; details?: string; message: string } | null;
      };
  }

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function listAdminDashboardUsers(actorRole: UserRole) {
  const [
    { data: users, error: usersError },
    { data: roleRows, error: rolesError },
    { data: companyRows, error: companiesError },
    subscriptionRows,
  ] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id,nombre,apellido,correo,telefono,estado,fecha_registro")
      .order("fecha_registro", { ascending: false }),
    supabase
      .from("usuario_rol")
      .select("usuario_id,roles(nombre)"),
    supabase
      .from("empresa_usuario")
      .select("usuario_id,empresas(id,nombre_comercial,rfc,estado)"),
    listSubscriptions(),
  ]);

  if (usersError) throw new Error(usersError.message);
  if (rolesError) throw new Error(rolesError.message);
  if (companiesError) throw new Error(companiesError.message);

  const rolesByUser = new Map<string, string[]>();
  for (const row of (roleRows ?? []) as unknown as RoleJoinRow[]) {
    if (!row.usuario_id) continue;
    rolesByUser.set(row.usuario_id, [
      ...(rolesByUser.get(row.usuario_id) ?? []),
      ...getRoleNames(row),
    ]);
  }

  const companiesByUser = new Map<string, ReturnType<typeof getFirstCompany>[]>();
  for (const row of (companyRows ?? []) as unknown as CompanyJoinRow[]) {
    if (!row.usuario_id) continue;
    const company = getFirstCompany(row);
    if (!company) continue;
    companiesByUser.set(row.usuario_id, [
      ...(companiesByUser.get(row.usuario_id) ?? []),
      company,
    ]);
  }

  const subscriptionsByCompany = new Map<string, SubscriptionRow>();
  for (const subscription of subscriptionRows) {
    if (!subscription.empresa_id) continue;
    subscriptionsByCompany.set(subscription.empresa_id, subscription);
  }

  return ((users ?? []) as UserRow[])
    .map<AdminDashboardUser>((user) => {
      const rol = pickHighestRole(rolesByUser.get(user.id) ?? []);
      const company = companiesByUser.get(user.id)?.[0] ?? null;
      const subscription = company ? subscriptionsByCompany.get(company.id) ?? null : null;
      const plan = subscription ? getFirstPlan(subscription) : null;
      const billingStatus = subscription?.estado_pago ?? "sin_datos";

      return {
        apellido: user.apellido,
        billingAmount: asNumber(subscription?.monto_mensual) ?? asNumber(plan?.precio_mensual),
        billingNotes: subscription?.notas_facturacion ?? null,
        billingStatus,
        billingStatusLabel: billingLabels[billingStatus] ?? billingStatus,
        companyName: company?.nombre_comercial ?? null,
        correo: user.correo,
        estado: user.estado,
        fechaRegistro: user.fecha_registro,
        id: user.id,
        nombre: user.nombre,
        nextBillingDate: subscription?.fecha_proxima_facturacion ?? null,
        planName: plan?.nombre ?? null,
        rol,
        rolLabel: roleLabel(rol),
        subscriptionStatus: subscription?.estado ?? null,
        telefono: user.telefono,
      };
    })
    .filter((user) => canTargetUserRole(actorRole, user.rol));
}
