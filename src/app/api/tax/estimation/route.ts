import { getApiUser } from "@/lib/auth";
import { fiscalFailure, fiscalSuccess, isUuid } from "@/lib/fiscalApi";
import { loadTaxEstimationsForUser, type TaxEstimationExecutionChannel } from "@/lib/taxEstimation";
import { isTaxPeriodKey } from "@/lib/taxEstimation.shared";

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);

  const searchParams = new URL(request.url).searchParams;
  const companyId = searchParams.get("companyId")?.trim() || null;
  const period = searchParams.get("period")?.trim() || null;
  const requestedChannel = searchParams.get("channel")?.trim().toLowerCase();
  const persist = searchParams.get("persist") !== "false";

  if (companyId && !isUuid(companyId)) {
    return fiscalFailure("INVALID_REQUEST", "companyId debe ser un UUID válido.", 400);
  }

  if (period && !isTaxPeriodKey(period)) {
    return fiscalFailure("INVALID_REQUEST", "period debe usar el formato YYYY-MM.", 400);
  }

  const channel: TaxEstimationExecutionChannel = requestedChannel === "mobile" ? "mobile" : "api";
  const result = await loadTaxEstimationsForUser(user, { channel, companyId, period, persist });
  if (result.error) {
    if (result.errorCode === "ACCESS_DENIED") {
      return fiscalFailure("ACCESS_DENIED", result.error, 403);
    }

    return fiscalFailure("DATABASE_ERROR", result.error, 500);
  }

  return fiscalSuccess({
    availableCompanies: result.companies,
    selectedCompanyId: result.selectedCompanyId,
    estimation: result.data,
    traceError: result.traceError,
    traceId: result.traceId,
  });
}
