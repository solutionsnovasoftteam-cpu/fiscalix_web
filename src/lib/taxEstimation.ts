import "server-only";

import { getAccessibleCompanies } from "@/lib/access-control";
import { isMissingMovementNormalizationColumn } from "@/lib/financialMovements";
import { supabase } from "@/lib/supabase";
import {
  calculateTaxEstimations,
  parseTaxEstimationPeriod,
  type TaxEstimationCompany,
  type TaxEstimationFiscalProfile,
  type TaxEstimationMovement,
  type TaxEstimationPeriod,
  type TaxEstimationResponse,
} from "@/lib/taxEstimation.shared";
import type { FiscalixUser } from "@/models/User";

type TaxEstimationErrorCode = "ACCESS_DENIED" | "DATABASE_ERROR";

type MovementViewRow = {
  activo_fiscal: boolean | null;
  base_fiscal: number | string | null;
  deducible: boolean | null;
  empresa_id: string | null;
  estado: string | null;
  fecha_movimiento: string | null;
  isr_retenido_monto: number | string | null;
  iva_monto: number | string | null;
  monto: number | string | null;
  tipo: string;
};

type RegimeRelation = {
  clave_sat: string | null;
  nombre: string | null;
};

type FiscalProfileRow = {
  activo: boolean | null;
  empresa_id: string | null;
  fecha_fin: string | null;
  fecha_inicio: string | null;
  regimenes_fiscales: RegimeRelation | RegimeRelation[] | null;
};

export type TaxEstimationLoadResult = {
  companies: TaxEstimationCompany[];
  data: TaxEstimationResponse | null;
  error: string | null;
  errorCode: TaxEstimationErrorCode | null;
  period: TaxEstimationPeriod;
  selectedCompanyId: string | null;
};

function companyName(value: string | null | undefined) {
  return value?.trim() || "Sin empresa";
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isProfileInPeriod(profile: FiscalProfileRow, period: TaxEstimationPeriod) {
  if (profile.fecha_inicio && profile.fecha_inicio > period.end) return false;
  if (profile.fecha_fin && profile.fecha_fin < period.start) return false;
  return true;
}

function movementFromRow(row: MovementViewRow): TaxEstimationMovement {
  return {
    amount: row.monto,
    companyId: row.empresa_id,
    date: row.fecha_movimiento,
    deductible: row.deducible,
    fiscalActive: row.activo_fiscal,
    fiscalBase: row.base_fiscal,
    isrWithheld: row.isr_retenido_monto,
    status: row.estado,
    type: row.tipo,
    vatAmount: row.iva_monto,
  };
}

function profileFromRow(row: FiscalProfileRow): TaxEstimationFiscalProfile {
  const regime = firstRelation(row.regimenes_fiscales);

  return {
    active: row.activo !== false,
    regimeName: regime?.nombre ?? null,
    satCode: regime?.clave_sat ?? null,
  };
}

function profileMapFromRows(rows: FiscalProfileRow[], period: TaxEstimationPeriod) {
  const byCompany = new Map<string, TaxEstimationFiscalProfile>();
  const sorted = [...rows].sort((a, b) => (b.fecha_inicio ?? "").localeCompare(a.fecha_inicio ?? ""));

  for (const row of sorted) {
    if (!row.empresa_id || byCompany.has(row.empresa_id)) continue;
    if (!isProfileInPeriod(row, period)) continue;
    byCompany.set(row.empresa_id, profileFromRow(row));
  }

  for (const row of sorted) {
    if (!row.empresa_id || byCompany.has(row.empresa_id)) continue;
    byCompany.set(row.empresa_id, profileFromRow(row));
  }

  return byCompany;
}

function isMissingNormalizedMovementsView(error: { code?: string; message?: string; details?: string } | null | undefined) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return error?.code === "42P01" || text.includes("movimientos_fiscales_normalizados");
}

export async function loadTaxEstimationsForUser(
  user: Pick<FiscalixUser, "id" | "rol">,
  options: { companyId?: string | null; period?: string | null } = {},
): Promise<TaxEstimationLoadResult> {
  const period = parseTaxEstimationPeriod(options.period);
  const { companies: accessibleCompanies, error: companiesError } = await getAccessibleCompanies(user);
  const companies = accessibleCompanies.map((company): TaxEstimationCompany => ({
    id: company.id,
    name: companyName(company.nombre_comercial),
  }));

  if (companiesError) {
    return {
      companies,
      data: null,
      error: "No fue posible consultar las empresas disponibles.",
      errorCode: "DATABASE_ERROR",
      period,
      selectedCompanyId: null,
    };
  }

  const selectedCompanyId = options.companyId?.trim() || null;
  const selectedCompanies = selectedCompanyId
    ? companies.filter((company) => company.id === selectedCompanyId)
    : companies;

  if (selectedCompanyId && selectedCompanies.length === 0) {
    return {
      companies,
      data: null,
      error: "No tienes acceso a la empresa solicitada.",
      errorCode: "ACCESS_DENIED",
      period,
      selectedCompanyId,
    };
  }

  const companyIds = selectedCompanies.map((company) => company.id);
  if (!companyIds.length) {
    return {
      companies,
      data: calculateTaxEstimations({
        companies: [],
        fiscalProfiles: new Map(),
        generatedAt: new Date().toISOString(),
        movements: [],
        period,
      }),
      error: null,
      errorCode: null,
      period,
      selectedCompanyId,
    };
  }

  const [movementsResult, profilesResult] = await Promise.all([
    supabase
      .from("movimientos_fiscales_normalizados")
      .select("tipo,empresa_id,fecha_movimiento,estado,deducible,monto,base_fiscal,iva_monto,isr_retenido_monto,activo_fiscal")
      .in("empresa_id", companyIds)
      .gte("fecha_movimiento", period.start)
      .lte("fecha_movimiento", period.end),
    supabase
      .from("empresa_fiscal")
      .select("empresa_id,activo,fecha_inicio,fecha_fin,regimenes_fiscales(clave_sat,nombre)")
      .in("empresa_id", companyIds),
  ]);

  if (movementsResult.error || profilesResult.error) {
    const error = movementsResult.error ?? profilesResult.error;
    const missingSource = isMissingNormalizedMovementsView(error) || isMissingMovementNormalizationColumn(error);

    return {
      companies,
      data: null,
      error: missingSource
        ? "Ejecuta primero la migración scripts/financial-movements-stage-5.sql para crear la fuente normalizada."
        : "No fue posible generar la estimación fiscal.",
      errorCode: "DATABASE_ERROR",
      period,
      selectedCompanyId,
    };
  }

  return {
    companies,
    data: calculateTaxEstimations({
      companies: selectedCompanies,
      fiscalProfiles: profileMapFromRows((profilesResult.data ?? []) as FiscalProfileRow[], period),
      generatedAt: new Date().toISOString(),
      movements: ((movementsResult.data ?? []) as MovementViewRow[]).map(movementFromRow),
      period,
    }),
    error: null,
    errorCode: null,
    period,
    selectedCompanyId,
  };
}
