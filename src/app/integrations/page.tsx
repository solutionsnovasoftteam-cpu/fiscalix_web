import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { IntegrationsHub, type IntegrationRow } from "@/app/integrations/integrations-hub";
import { supabase } from "@/lib/supabase";

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("integraciones")
    .select("id,nombre,tipo,estado,partner")
    .order("nombre", { ascending: true });

  return (
    <AppShell activeHref="/integrations" user={user}>
      <IntegrationsHub initialRows={(data ?? []) as IntegrationRow[]} />
    </AppShell>
  );
}
