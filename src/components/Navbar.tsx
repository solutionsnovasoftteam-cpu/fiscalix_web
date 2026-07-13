import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { FiscalixUser } from "@/models/User";
import { initials } from "@/lib/utils";

export function Navbar({ user }: { user: FiscalixUser }) {
  return (
    <header className="topbar">
      <label className="search"><Icon name="search" /><input aria-label="Buscar" placeholder="Buscar en Fiscalix..." /></label>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notificaciones"><Icon name="notifications" /><span className="notification-dot" /></button>
        <Link className="avatar small profile-link" href="/profile" aria-label="Ir a mi perfil" title="Mi perfil">
          {initials(user.nombre, user.apellido)}
        </Link>
        <form className="topbar-logout" action="/api/auth/logout" method="post">
          <button type="submit"><Icon name="logout" /><span>Cerrar sesión</span></button>
        </form>
      </div>
    </header>
  );
}
