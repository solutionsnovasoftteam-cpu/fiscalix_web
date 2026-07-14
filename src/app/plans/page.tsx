import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PlansManager } from "@/components/PlansManager";
import { getCurrentUser } from "@/lib/auth";
import {
  basicPlanSelect,
  extendedPlanSelect,
  isMissingPlanColumnError,
  mergePlansWithDbRows,
  type PlanDbRow,
} from "@/lib/plans";
import { canManagePlans } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type PlanQueryResult = {
  data: PlanDbRow[] | null;
  error: { code?: string; details?: string; message?: string } | null;
};

export default async function PlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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

  return (
    <AppShell activeHref="/plans" user={user}>
      <PlansManager
        canManagePlans={canManagePlans(user)}
        initialPlans={plans}
        initialStatus={planResult.error ? "No fue posible cargar los planes desde Supabase. Se muestra la configuración base." : ""}
      />
    </AppShell>
  );
}
