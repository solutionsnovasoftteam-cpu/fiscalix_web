import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { SettingsHub, type SettingsInitialData } from "@/app/settings/settings-hub";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
        action: "Consulta",
        date: now,
        description: "Preferencias del sistema cargadas correctamente.",
        id: "settings-supabase-load",
        module: "Configuraciones",
        user: `${user.nombre} ${user.apellido ?? ""}`.trim(),
      },
    ],
    userName: `${user.nombre} ${user.apellido ?? ""}`.trim() || "Tú",
  };

  return (
    <AppShell activeHref="/settings" user={user}>
      <SettingsHub initialData={initialData} />
    </AppShell>
  );
}
