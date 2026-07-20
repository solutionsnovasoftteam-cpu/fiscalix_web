import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { SettingsHub } from "@/app/settings/settings-hub";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell activeHref="/settings" user={user}>
      <SettingsHub />
    </AppShell>
  );
}
