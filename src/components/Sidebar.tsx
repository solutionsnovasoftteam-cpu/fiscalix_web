import Link from "next/link";
import { Brand } from "@/components/Brand";
import { initials } from "@/lib/utils";
import type { FiscalixUser } from "@/models/User";

const nav = [
  ["Inicio", "/dashboard", "⌂"],
  ["Empresas", "/companies", "▣"],
  ["Movimientos", "/transactions", "⇄"],
  ["Impuestos", "/taxes", "%"],
  ["Reportes", "/reports", "▥"],
] as const;

export function Sidebar({ user }: { user: FiscalixUser }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <nav className="main-nav" aria-label="Navegación principal">
        <p>MENÚ PRINCIPAL</p>
        {nav.map(([label, href, icon], index) => (
          <Link className={index === 0 ? "nav-link active" : "nav-link"} href={href} key={href}>
            <span aria-hidden="true">{icon}</span>{label}
          </Link>
        ))}
        <p>CUENTA</p>
        <Link className="nav-link" href="/profile"><span aria-hidden="true">◎</span>Mi perfil</Link>
        <Link className="nav-link" href="/settings"><span aria-hidden="true">⚙</span>Configuración</Link>
      </nav>
      <div className="sidebar-user">
        <span className="avatar">{initials(user.nombre, user.apellido)}</span>
        <span><strong>{user.nombre} {user.apellido}</strong><small>{user.correo}</small></span>
        <form className="sidebar-logout" action="/api/auth/logout" method="post">
          <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"><span aria-hidden="true">↪</span><span>Cerrar sesión</span></button>
        </form>
      </div>
    </aside>
  );
}
