import { redirect } from "next/navigation";
import { AdminUsersDashboard } from "@/components/AdminUsersDashboard";
import { AppShell } from "@/components/AppShell";
import { listAdminDashboardUsers } from "@/lib/adminUsers";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewAdminDashboard(user)) redirect("/dashboard");

  const users = await listAdminDashboardUsers(user.rol);

  return (
    <AppShell activeHref="/admin" user={user}>
      <AdminUsersDashboard currentUser={user} users={users} />
    </AppShell>
  );
}
