import { getApiUser } from "@/lib/auth";
import { fiscalFailure, fiscalSuccess } from "@/lib/fiscalApi";
import { TAX_REGIME_RULES } from "@/lib/taxEstimation.shared";

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);

  return fiscalSuccess({
    enabledRegimes: TAX_REGIME_RULES.filter((rule) => rule.enabled).map((rule) => rule.key),
    regimes: TAX_REGIME_RULES,
  });
}
