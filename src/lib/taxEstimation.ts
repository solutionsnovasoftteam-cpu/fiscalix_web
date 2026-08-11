import "server-only";

import { getAccessibleCompanies } from "@/lib/access-control";
import { isMissingMovementNormalizationColumn } from "@/lib/financialMovements";
import { supabase } from "@/lib/supabase";
import {
  calculateTaxEstimations,
  parseTaxEstimationPeriod,
  taxEstimationFormulaSnapshot,
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
  id: string;
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
  traceError: string | null;
  traceId: string | null;
};

export type TaxEstimationExecutionChannel = "api" | "web";

export type TaxEstimationHistoryItem = {
  base: number;
  channel: string;
  companyId: string | null;
  createdAt: string;
  id: string;
  income: number;
  isrEstimated: number;
  movementCount: number;
  periodKey: string;
  taxEstimated: number;
  userId: string;
  vatEstimated: number;
};

export type TaxEstimationHistoryMovement = {
  amount: number;
  considered: boolean;
  date: string | null;
  exclusionReason: string | null;
  fiscalBase: number;
  id: string;
  movementId: string;
  status: string | null;
  type: string;
  vatAmount: number;
};

export type TaxEstimationHistoryDetail = TaxEstimationHistoryItem & {
  formula: unknown;
  movements: TaxEstimationHistoryMovement[];
  parameters: unknown;
  result: unknown;
  ruleCode: string | null;
  ruleVersion: string | null;
  variables: unknown;
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
    id: row.id,
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

function isMissingTraceTable(error: { code?: string; message?: string; details?: string } | null | undefined) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return error?.code === "42P01"
    || text.includes("estimaciones_fiscales_ejecuciones")
    || text.includes("estimaciones_fiscales_movimientos")
    || text.includes("reglas_fiscales_versiones");
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function historyItemFromRow(row: Record<string, unknown>): TaxEstimationHistoryItem {
  return {
    base: numberValue(row.base_fiscal),
    channel: String(row.canal ?? ""),
    companyId: typeof row.empresa_id === "string" ? row.empresa_id : null,
    createdAt: String(row.created_at ?? ""),
    id: String(row.id ?? ""),
    income: numberValue(row.total_ingresos),
    isrEstimated: numberValue(row.isr_estimado),
    movementCount: numberValue(row.movimientos_total),
    periodKey: String(row.periodo_clave ?? ""),
    taxEstimated: numberValue(row.impuesto_estimado),
    userId: String(row.usuario_id ?? ""),
    vatEstimated: numberValue(row.iva_estimado),
  };
}

function historyMovementFromRow(row: Record<string, unknown>): TaxEstimationHistoryMovement {
  return {
    amount: numberValue(row.monto),
    considered: row.considerado === true,
    date: typeof row.fecha_movimiento === "string" ? row.fecha_movimiento : null,
    exclusionReason: typeof row.razon_exclusion === "string" ? row.razon_exclusion : null,
    fiscalBase: numberValue(row.base_fiscal),
    id: String(row.id ?? ""),
    movementId: String(row.movimiento_id ?? ""),
    status: typeof row.estado === "string" ? row.estado : null,
    type: String(row.tipo ?? ""),
    vatAmount: numberValue(row.iva_monto),
  };
}

async function saveTaxEstimationExecution({
  channel,
  data,
  selectedCompanyId,
  user,
}: {
  channel: TaxEstimationExecutionChannel;
  data: TaxEstimationResponse;
  selectedCompanyId: string | null;
  user: Pick<FiscalixUser, "id">;
}) {
  const formula = taxEstimationFormulaSnapshot();
  const ruleRows: Array<{
    activo: boolean;
    clave: string;
    descripcion: string;
    formula: unknown;
    fuente: string;
    nombre: string;
    regimen_clave_sat: string;
    variables: unknown;
    version: string;
  }> = data.regimeCatalog.map((rule) => ({
    activo: rule.enabled,
    clave: rule.ruleVersion.code,
    descripcion: rule.ruleVersion.description,
    formula: rule.formulas,
    fuente: "Fiscalix Etapa 8",
    nombre: rule.name,
    regimen_clave_sat: rule.satCodes.join(","),
    variables: {
      requiredData: rule.requiredData,
      status: rule.status,
      testCaseFile: rule.testCaseFile,
      validations: rule.validations,
    },
    version: rule.ruleVersion.version,
  }));
  if (!ruleRows.some((rule) => rule.clave === data.ruleVersion.code)) {
    ruleRows.push({
      activo: true,
      clave: data.ruleVersion.code,
      descripcion: data.ruleVersion.description,
      formula,
      fuente: "Fiscalix Etapa 8",
      nombre: data.regime.name,
      regimen_clave_sat: data.regime.satCode,
      variables: {
        requiredData: ["movimientos_fiscales_normalizados", "catálogo de reglas fiscales habilitadas"],
        status: "enabled",
        testCaseFile: "docs/tax-estimation-stage-8-cases.json",
        validations: ["orquestación de múltiples regímenes fiscales"],
      },
      version: data.ruleVersion.version,
    });
  }
  const { error: rulesError } = await supabase
    .from("reglas_fiscales_versiones")
    .upsert(ruleRows, { onConflict: "clave" });

  if (rulesError) {
    return {
      error: isMissingTraceTable(rulesError)
        ? "Ejecuta scripts/tax-estimation-stage-7.sql y scripts/tax-estimation-stage-8.sql para activar la trazabilidad."
        : "No fue posible registrar el catálogo de reglas fiscales.",
      id: null,
    };
  }

  const { data: ruleVersion, error: ruleError } = await supabase
    .from("reglas_fiscales_versiones")
    .select("id")
    .eq("clave", data.ruleVersion.code)
    .single();

  if (ruleError) {
    return {
      error: isMissingTraceTable(ruleError)
        ? "Ejecuta scripts/tax-estimation-stage-7.sql para activar la trazabilidad."
        : "No fue posible registrar la versión de reglas fiscales.",
      id: null,
    };
  }

  const considered = data.movementTrace.filter((movement) => movement.considered).length;
  const excluded = data.movementTrace.length - considered;
  const resultSnapshot = {
    companies: data.companies,
    period: data.period,
    regime: data.regime,
    regimeCatalog: data.regimeCatalog,
    ruleVersion: data.ruleVersion,
    source: data.source,
    totals: data.totals,
  };
  const variables = {
    companies: data.companies.map((company) => ({
      base: company.base,
      companyId: company.companyId,
      deductibleExpenses: company.deductibleExpenses,
      expenses: company.expenses,
      incomes: company.incomes,
      isrDetermined: company.isrDetermined,
      isrRate: company.isrRate,
      isrWithheld: company.isrWithheld,
      regimeKey: company.regimeKey,
      regimeRuleVersion: company.regimeRuleVersion,
      regimeStatus: company.regimeStatus,
      validationMessages: company.validationMessages,
      vatCreditable: company.vatCreditable,
      vatTransferred: company.vatTransferred,
    })),
    totals: data.totals,
  };

  const { data: execution, error: executionError } = await supabase
    .from("estimaciones_fiscales_ejecuciones")
    .insert({
      base_fiscal: data.totals.base,
      canal: channel,
      empresa_id: selectedCompanyId,
      formula_aplicada: formula,
      fuente_datos: data.source,
      impuesto_estimado: data.totals.taxEstimated,
      isr_estimado: data.totals.isrEstimated,
      iva_estimado: data.totals.vatEstimated,
      movimientos_considerados: considered,
      movimientos_excluidos: excluded,
      movimientos_total: data.movementTrace.length,
      parametros: {
        companyId: selectedCompanyId,
        period: data.period.key,
      },
      periodo_clave: data.period.key,
      periodo_fin: data.period.end,
      periodo_inicio: data.period.start,
      regla_clave: data.ruleVersion.code,
      regla_version: data.ruleVersion.version,
      regla_version_id: ruleVersion?.id ?? null,
      regimen_clave_sat: data.regime.satCode,
      resultado: resultSnapshot,
      total_gastos: data.totals.expenses,
      total_ingresos: data.totals.incomes,
      usuario_id: user.id,
      variables,
    })
    .select("id")
    .single();

  if (executionError || !execution?.id) {
    return {
      error: isMissingTraceTable(executionError)
        ? "Ejecuta scripts/tax-estimation-stage-7.sql para activar la trazabilidad."
        : "No fue posible guardar la ejecución fiscal.",
      id: null,
    };
  }

  if (data.movementTrace.length) {
    const { error: movementsError } = await supabase
      .from("estimaciones_fiscales_movimientos")
      .insert(data.movementTrace.map((movement) => ({
        base_fiscal: movement.fiscalBase,
        considerado: movement.considered,
        deducible: movement.deductible,
        ejecucion_id: execution.id,
        empresa_id: movement.companyId,
        estado: movement.status,
        fecha_movimiento: movement.date,
        isr_retenido_monto: movement.isrWithheld,
        iva_monto: movement.vatAmount,
        monto: movement.amount,
        movimiento_id: movement.id,
        razon_exclusion: movement.exclusionReason,
        snapshot: movement,
        tipo: movement.type,
      })));

    if (movementsError) {
      return {
        error: isMissingTraceTable(movementsError)
          ? "Ejecuta scripts/tax-estimation-stage-7.sql para activar la trazabilidad."
          : "La ejecución se guardó, pero no fue posible vincular sus movimientos.",
        id: execution.id as string,
      };
    }
  }

  return { error: null, id: execution.id as string };
}

export async function loadTaxEstimationsForUser(
  user: Pick<FiscalixUser, "id" | "rol">,
  options: {
    channel?: TaxEstimationExecutionChannel;
    companyId?: string | null;
    period?: string | null;
    persist?: boolean;
  } = {},
): Promise<TaxEstimationLoadResult> {
  const period = parseTaxEstimationPeriod(options.period);
  const fiscalYearStart = `${period.year}-01-01`;
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
      traceError: null,
      traceId: null,
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
      traceError: null,
      traceId: null,
    };
  }

  const companyIds = selectedCompanies.map((company) => company.id);
  if (!companyIds.length) {
    const data = calculateTaxEstimations({
      companies: [],
      fiscalProfiles: new Map(),
      generatedAt: new Date().toISOString(),
      movements: [],
      period,
    });
    const trace = options.persist === false
      ? { error: null, id: null }
      : await saveTaxEstimationExecution({
          channel: options.channel ?? "web",
          data,
          selectedCompanyId,
          user,
        });

    return {
      companies,
      data,
      error: null,
      errorCode: null,
      period,
      selectedCompanyId,
      traceError: trace.error,
      traceId: trace.id,
    };
  }

  const [movementsResult, profilesResult] = await Promise.all([
    supabase
      .from("movimientos_fiscales_normalizados")
      .select("id,tipo,empresa_id,fecha_movimiento,estado,deducible,monto,base_fiscal,iva_monto,isr_retenido_monto,activo_fiscal")
      .in("empresa_id", companyIds)
      .gte("fecha_movimiento", fiscalYearStart)
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
      traceError: null,
      traceId: null,
    };
  }

  const data = calculateTaxEstimations({
    companies: selectedCompanies,
    fiscalProfiles: profileMapFromRows((profilesResult.data ?? []) as FiscalProfileRow[], period),
    generatedAt: new Date().toISOString(),
    movements: ((movementsResult.data ?? []) as MovementViewRow[]).map(movementFromRow),
    period,
  });
  const trace = options.persist === false
    ? { error: null, id: null }
    : await saveTaxEstimationExecution({
        channel: options.channel ?? "web",
        data,
        selectedCompanyId,
        user,
      });

  return {
    companies,
    data,
    error: null,
    errorCode: null,
    period,
    selectedCompanyId,
    traceError: trace.error,
    traceId: trace.id,
  };
}

export async function loadTaxEstimationHistoryForUser(
  user: Pick<FiscalixUser, "id">,
  options: { executionId?: string | null; limit?: number } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 50);

  if (options.executionId) {
    const { data: execution, error: executionError } = await supabase
      .from("estimaciones_fiscales_ejecuciones")
      .select("*")
      .eq("usuario_id", user.id)
      .eq("id", options.executionId)
      .maybeSingle();

    if (executionError) {
      return {
        data: null,
        error: isMissingTraceTable(executionError)
          ? "Ejecuta scripts/tax-estimation-stage-7.sql para consultar el historial."
          : "No fue posible consultar la ejecución histórica.",
      };
    }

    if (!execution) return { data: null, error: null };

    const { data: movements, error: movementsError } = await supabase
      .from("estimaciones_fiscales_movimientos")
      .select("*")
      .eq("ejecucion_id", options.executionId)
      .order("fecha_movimiento", { ascending: true });

    if (movementsError) {
      return {
        data: null,
        error: isMissingTraceTable(movementsError)
          ? "Ejecuta scripts/tax-estimation-stage-7.sql para consultar movimientos históricos."
          : "No fue posible consultar los movimientos de la ejecución.",
      };
    }

    const row = execution as Record<string, unknown>;
    const detail: TaxEstimationHistoryDetail = {
      ...historyItemFromRow(row),
      formula: row.formula_aplicada ?? null,
      movements: ((movements ?? []) as Record<string, unknown>[]).map(historyMovementFromRow),
      parameters: row.parametros ?? null,
      result: row.resultado ?? null,
      ruleCode: typeof row.regla_clave === "string" ? row.regla_clave : null,
      ruleVersion: typeof row.regla_version === "string" ? row.regla_version : null,
      variables: row.variables ?? null,
    };

    return { data: detail, error: null };
  }

  const { data, error } = await supabase
    .from("estimaciones_fiscales_ejecuciones")
    .select("id,usuario_id,empresa_id,periodo_clave,canal,total_ingresos,base_fiscal,iva_estimado,isr_estimado,impuesto_estimado,movimientos_total,created_at")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      data: [] as TaxEstimationHistoryItem[],
      error: isMissingTraceTable(error)
        ? "Ejecuta scripts/tax-estimation-stage-7.sql para consultar el historial."
        : "No fue posible consultar el historial de estimaciones.",
    };
  }

  return {
    data: ((data ?? []) as Record<string, unknown>[]).map(historyItemFromRow),
    error: null,
  };
}
