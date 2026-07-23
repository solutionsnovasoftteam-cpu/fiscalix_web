import Link from "next/link";
import { Icon } from "@/components/Icon";
import { NotificationBell } from "@/components/NotificationBell";
import type { FiscalixUser } from "@/models/User";
import { initials } from "@/lib/utils";

export function Navbar({ user }: { user: FiscalixUser }) {
  return (
    <header className="topbar">
      <label className="search"><Icon name="search" /><input aria-label="Buscar" placeholder="Buscar en Fiscalix..." /></label>
      <div className="topbar-actions">
        <NotificationBell />
        <Link className="avatar small profile-link" href="/profile" aria-label="Ir a mi perfil" title="Mi perfil">
          {initials(user.nombre, user.apellido)}
        </Link>
      </div>
    </header>
  );
}
