import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { IntegrationsHub, type IntegrationRow } from "@/app/integrations/integrations-hub";
import { listIntegrations } from "@/lib/integrationPersistence";
import { canManageIntegrations } from "@/lib/roles";

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data } = await listIntegrations();

  return (
    <AppShell activeHref="/integrations" user={user}>
      <IntegrationsHub canManage={canManageIntegrations(user)} initialRows={(data ?? []) as IntegrationRow[]} />
    </AppShell>
  );
}
