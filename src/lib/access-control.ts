import "server-only";

import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { FiscalixUser } from "@/models/User";

export type AccessControlUser = Pick<FiscalixUser, "id" | "rol">;

export type AccessibleCompany = {
  estado: string | null;
  id: string;
  nombre_comercial: string | null;
};

type CompanyMembershipRow = {
  empresa_id: string | null;
};

export type CompanyAccessOptions = {
  adminMode?: "owned" | "admin_all";
  includeSuspended?: boolean;
};

const DEFAULT_ACCESS_OPTIONS = {
  adminMode: "owned",
  includeSuspended: false,
} satisfies Required<CompanyAccessOptions>;

function withDefaultOptions(options: CompanyAccessOptions = {}) {
  return {
    ...DEFAULT_ACCESS_OPTIONS,
    ...options,
  };
}

function filterCompaniesByStatus(companies: AccessibleCompany[], includeSuspended: boolean) {
  if (includeSuspended) return companies;
  return companies.filter((company) => company.estado !== "suspendida");
}

function uniqueTextValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean))] as string[];
}

export function isMissingColumnError(error: { code?: string; message?: string; details?: string } | null | undefined, columnName: string) {
  const needle = columnName.toLowerCase();
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return error?.code === "42703" || message.includes(needle);
}

export async function getUserCompanyIds(userId: string) {
  const { data, error } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", userId);

  return {
    companyIds: uniqueTextValues(((data ?? []) as CompanyMembershipRow[]).map((row) => row.empresa_id)),
    error,
  };
}

export async function getAccessibleCompanies(user: AccessControlUser, options?: CompanyAccessOptions) {
  const resolvedOptions = withDefaultOptions(options);

  if (resolvedOptions.adminMode === "admin_all" && canViewAdminDashboard(user)) {
    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre_comercial,estado")
      .order("nombre_comercial", { ascending: true });

    return {
      companies: filterCompaniesByStatus((data ?? []) as AccessibleCompany[], resolvedOptions.includeSuspended),
      error,
    };
  }

  const { companyIds, error: membershipError } = await getUserCompanyIds(user.id);
  if (membershipError || !companyIds.length) {
    return { companies: [] as AccessibleCompany[], error: membershipError };
  }

  const { data, error } = await supabase
    .from("empresas")
    .select("id,nombre_comercial,estado")
    .in("id", companyIds)
    .order("nombre_comercial", { ascending: true });

  return {
    companies: filterCompaniesByStatus((data ?? []) as AccessibleCompany[], resolvedOptions.includeSuspended),
    error,
  };
}

export async function getAccessibleCompanyIds(user: AccessControlUser, options?: CompanyAccessOptions) {
  const { companies, error } = await getAccessibleCompanies(user, options);
  return {
    companyIds: companies.map((company) => company.id),
    error,
  };
}

export async function getCompanyIfAccessible(user: AccessControlUser, companyId: string, options?: CompanyAccessOptions) {
  const resolvedOptions = withDefaultOptions(options);
  const { data: company, error: companyError } = await supabase
    .from("empresas")
    .select("id,nombre_comercial,estado")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) return { company: null, error: companyError };
  if (!company) return { company: null, error: null };
  if (!resolvedOptions.includeSuspended && company.estado === "suspendida") {
    return { company: null, error: null };
  }

  if (resolvedOptions.adminMode === "admin_all" && canViewAdminDashboard(user)) {
    return { company: company as AccessibleCompany, error: null };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .eq("empresa_id", companyId)
    .maybeSingle();

  if (membershipError) return { company: null, error: membershipError };
  return { company: membership ? company as AccessibleCompany : null, error: null };
}

export async function canAccessCompany(user: AccessControlUser, companyId: string, options?: CompanyAccessOptions) {
  const { company, error } = await getCompanyIfAccessible(user, companyId, options);
  return { allowed: Boolean(company), company, error };
}

export async function getPrimaryAccessibleCompany(user: AccessControlUser, options?: CompanyAccessOptions) {
  const { companies, error } = await getAccessibleCompanies(user, options);
  return {
    company: companies[0] ?? null,
    error,
  };
}
