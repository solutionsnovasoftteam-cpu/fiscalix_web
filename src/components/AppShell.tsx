import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { UserPreferencesApplier } from "@/components/UserPreferencesApplier";
import type { FiscalixUser } from "@/models/User";

export function AppShell({
  activeHref = "/dashboard",
  children,
  user,
}: {
  activeHref?: string;
  children: React.ReactNode;
  user: FiscalixUser;
}) {
  return (
    <div className="app-shell">
      <UserPreferencesApplier preferences={user.preferences} />
      <Sidebar activeHref={activeHref} user={user} />
      <div className="app-main">
        <Navbar user={user} />
        {children}
      </div>
    </div>
  );
}
