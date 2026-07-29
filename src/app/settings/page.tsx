import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { SettingsHub, type SettingsInitialData } from "@/app/settings/settings-hub";
import { createTranslator } from "@/lib/i18n";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = createTranslator(user.preferences?.language);

  const now = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const initialData: SettingsInitialData = {
    activity: [
      {
        action: t("settings.detail"),
        date: now,
        description: t("settings.activityLoaded"),
        id: "settings-supabase-load",
        module: t("settings.moduleName"),
        user: `${user.nombre} ${user.apellido ?? ""}`.trim(),
      },
    ],
    userName: `${user.nombre} ${user.apellido ?? ""}`.trim() || t("settings.you"),
  };

  return (
    <AppShell activeHref="/settings" user={user}>
      <SettingsHub initialData={initialData} language={user.preferences?.language} />
    </AppShell>
  );
}
