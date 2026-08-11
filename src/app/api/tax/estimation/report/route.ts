import { getApiUser } from "@/lib/auth";
import { fiscalFailure, fiscalSuccess, isUuid } from "@/lib/fiscalApi";
import {
  loadTaxEstimationReportForUser,
  type TaxEstimationHistoryScope,
  type TaxEstimationMovementFilter,
  type TaxEstimationReportStatus,
} from "@/lib/taxEstimation";
import { isTaxPeriodKey, TAX_REGIME_RULES } from "@/lib/taxEstimation.shared";

const REPORT_STATUSES = new Set<TaxEstimationReportStatus>(["all", "estimated", "limited", "review"]);
const MOVEMENT_FILTERS = new Set<TaxEstimationMovementFilter>(["all", "considered", "excluded"]);
const HISTORY_SCOPES = new Set<TaxEstimationHistoryScope>(["all", "period"]);
const SUPPORTED_SAT_CODES = new Set(TAX_REGIME_RULES.flatMap((rule) => rule.satCodes));

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);

  const searchParams = new URL(request.url).searchParams;
  const companyId = searchParams.get("companyId")?.trim() || null;
  const period = searchParams.get("period")?.trim() || null;
  const regimeSatCode = searchParams.get("regime")?.trim() || null;
  const status = (searchParams.get("status")?.trim() || "all") as TaxEstimationReportStatus;
  const movementFilter = (searchParams.get("movement")?.trim() || "all") as TaxEstimationMovementFilter;
  const historyScope = (searchParams.get("history")?.trim() || "period") as TaxEstimationHistoryScope;

  if (companyId && !isUuid(companyId)) {
    return fiscalFailure("INVALID_REQUEST", "companyId debe ser un UUID válido.", 400);
  }
  if (period && !isTaxPeriodKey(period)) {
    return fiscalFailure("INVALID_REQUEST", "period debe usar el formato YYYY-MM.", 400);
  }
  if (regimeSatCode && !SUPPORTED_SAT_CODES.has(regimeSatCode)) {
    return fiscalFailure("INVALID_REQUEST", "regime debe ser una clave SAT habilitada.", 400);
  }
  if (!REPORT_STATUSES.has(status) || !MOVEMENT_FILTERS.has(movementFilter) || !HISTORY_SCOPES.has(historyScope)) {
    return fiscalFailure("INVALID_REQUEST", "Los filtros fiscales solicitados no son válidos.", 400);
  }

  const result = await loadTaxEstimationReportForUser(user, {
    companyId,
    historyScope,
    movementFilter,
    period,
    regimeSatCode,
    status,
  });

  if (result.error) {
    if (result.errorCode === "ACCESS_DENIED") return fiscalFailure("ACCESS_DENIED", result.error, 403);
    return fiscalFailure("DATABASE_ERROR", result.error, 500);
  }

  return fiscalSuccess({
    availableCompanies: result.data?.companies ?? [],
    historyError: result.historyError,
    report: result.data,
  });
}
