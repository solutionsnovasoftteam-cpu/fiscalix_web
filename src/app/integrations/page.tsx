import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { IntegrationsHub } from "@/app/integrations/integrations-hub";

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell activeHref="/integrations" user={user}>
      <IntegrationsHub />
    </AppShell>
  );
}
