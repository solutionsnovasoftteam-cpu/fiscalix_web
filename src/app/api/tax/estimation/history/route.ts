import { getApiUser } from "@/lib/auth";
import { fiscalFailure, fiscalSuccess, isUuid } from "@/lib/fiscalApi";
import { loadTaxEstimationHistoryForUser } from "@/lib/taxEstimation";

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);

  const searchParams = new URL(request.url).searchParams;
  const id = searchParams.get("id")?.trim() || null;
  const limitParam = searchParams.get("limit")?.trim() || null;

  if (id && !isUuid(id)) {
    return fiscalFailure("INVALID_REQUEST", "id debe ser un UUID válido.", 400);
  }

  let limit: number | undefined;
  if (limitParam) {
    const parsedLimit = Number(limitParam);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return fiscalFailure("INVALID_REQUEST", "limit debe ser un entero entre 1 y 50.", 400);
    }
    limit = parsedLimit;
  }

  const result = await loadTaxEstimationHistoryForUser(user, { executionId: id, limit });
  if (result.error) return fiscalFailure("DATABASE_ERROR", result.error, 500);
  if (id && !result.data) return fiscalFailure("NOT_FOUND", "No encontramos esa ejecución fiscal.", 404);

  return fiscalSuccess(id ? { execution: result.data } : { history: result.data });
}
