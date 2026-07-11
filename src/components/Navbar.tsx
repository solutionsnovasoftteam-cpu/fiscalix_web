import type { FiscalixUser } from "@/models/User";
import { initials } from "@/lib/utils";

export function Navbar({ user }: { user: FiscalixUser }) {
  return (
    <header className="topbar">
      <label className="search"><span aria-hidden="true">⌕</span><input aria-label="Buscar" placeholder="Buscar en Fiscalix..." /></label>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notificaciones">♢<span className="notification-dot" /></button>
        <span className="avatar small">{initials(user.nombre, user.apellido)}</span>
        <form className="topbar-logout" action="/api/auth/logout" method="post">
          <button type="submit"><span aria-hidden="true">↪</span><span>Cerrar sesión</span></button>
        </form>
      </div>
    </header>
  );
}
