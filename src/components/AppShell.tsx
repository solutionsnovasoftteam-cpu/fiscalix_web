import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
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
      <Sidebar activeHref={activeHref} user={user} />
      <div className="app-main">
        <Navbar user={user} />
        {children}
      </div>
    </div>
  );
}
