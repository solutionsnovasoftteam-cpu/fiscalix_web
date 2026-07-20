import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { canViewAdminDashboard } from "@/lib/roles";
import type { FiscalixUser } from "@/models/User";

const nav = [
  ["Inicio", "/dashboard", "home"],
  ["Mi empresa", "/companies", "business"],
  ["Movimientos", "/transactions", "sync_alt"],
  ["Ingresos", "/income", "trending_up"],
  ["Gastos", "/expenses", "trending_down"],
  ["Impuestos", "/taxes", "percent"],
  ["Planes", "/plans", "payments"],
  ["Reportes", "/reports", "bar_chart"],
  ["Comprobantes", "/receipts", "receipt_long"],
  ["Centro fiscal", "/centro-fiscal", "language"],
  ["Integraciones", "/integrations", "api"],
  ["Nómina", "/payroll", "payments"],
  ["Más configuraciones", "/settings", "settings"],
] as const;

const adminNav = ["Administración", "/admin", "manage_accounts"] as const;

export function Sidebar({ activeHref = "/dashboard", user }: { activeHref?: string; user: FiscalixUser }) {
  const items = canViewAdminDashboard(user) ? [...nav, adminNav] : nav;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <nav className="main-nav" aria-label="Navegación principal">
        {items.map(([label, href, icon]) => (
          <Link className={activeHref === href ? "nav-link active" : "nav-link"} href={href} key={href}>
            <span aria-hidden="true"><Icon name={icon} /></span>{label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
