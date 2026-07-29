import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PlansManager } from "@/components/PlansManager";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import {
  basicPlanSelect,
  extendedPlanSelect,
  isMissingPlanColumnError,
  mergePlansWithDbRows,
  type PlanDbRow,
} from "@/lib/plans";
import { canManagePlans, USER_ROLES } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type PlanQueryResult = {
  data: PlanDbRow[] | null;
  error: { code?: string; details?: string; message?: string } | null;
};

export default async function PlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = createTranslator(user.preferences?.language);

  let planResult = await supabase
    .from("planes")
    .select(extendedPlanSelect)
    .order("orden", { ascending: true, nullsFirst: false })
    .order("precio_mensual", { ascending: true }) as unknown as PlanQueryResult;

  if (planResult.error && isMissingPlanColumnError(planResult.error)) {
    planResult = await supabase
      .from("planes")
      .select(basicPlanSelect)
      .order("precio_mensual", { ascending: true }) as unknown as PlanQueryResult;
  }

  const plans = mergePlansWithDbRows((planResult.data ?? []) as PlanDbRow[]);
  const canSubscribePlans = user.rol === USER_ROLES.CLIENT;
  let currentPlanDatabaseId: string | null = null;

  if (canSubscribePlans) {
    const { data: membership } = await supabase
      .from("empresa_usuario")
      .select("empresa_id")
      .eq("usuario_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership?.empresa_id) {
      const { data: subscription } = await supabase
        .from("suscripciones")
        .select("plan_id")
        .eq("empresa_id", membership.empresa_id)
        .maybeSingle();

      currentPlanDatabaseId = subscription?.plan_id ?? null;
    }
  }

  return (
    <AppShell activeHref="/plans" user={user}>
      <PlansManager
        canManagePlans={canManagePlans(user)}
        canSubscribePlans={canSubscribePlans}
        currentPlanDatabaseId={currentPlanDatabaseId}
        initialPlans={plans}
        initialStatus={planResult.error ? t("plans.loadError") : ""}
        language={user.preferences?.language}
      />
    </AppShell>
  );
}
