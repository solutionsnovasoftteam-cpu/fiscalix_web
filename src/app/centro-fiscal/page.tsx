import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { CentroFiscalHub } from "@/app/centro-fiscal/centro-fiscal-hub";

export default async function CentroFiscalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell activeHref="/centro-fiscal" user={user}>
      <CentroFiscalHub serverNow={new Date().toISOString()} />
    </AppShell>
  );
}
