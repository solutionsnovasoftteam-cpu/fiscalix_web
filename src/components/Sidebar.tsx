import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import { canViewAdminDashboard } from "@/lib/roles";
import type { FiscalixUser } from "@/models/User";

const nav = [
  ["nav.home", "/dashboard", "home"],
  ["nav.company", "/companies", "business"],
  ["nav.movements", "/transactions", "sync_alt"],
  ["nav.income", "/income", "trending_up"],
  ["nav.expenses", "/expenses", "trending_down"],
  ["nav.taxes", "/taxes", "percent"],
  ["nav.plans", "/plans", "payments"],
  ["nav.reports", "/reports", "bar_chart"],
  ["nav.receipts", "/receipts", "receipt_long"],
  ["nav.fiscalCenter", "/centro-fiscal", "language"],
  ["nav.integrations", "/integrations", "api"],
  ["nav.payroll", "/payroll", "payments"],
  ["nav.moreSettings", "/settings", "settings"],
] as const;

const adminNav = ["nav.admin", "/admin", "manage_accounts"] as const;
const supportNav = ["nav.clarifications", "/support", "support_agent"] as const;

export function Sidebar({ activeHref = "/dashboard", user }: { activeHref?: string; user: FiscalixUser }) {
  const t = createTranslator(user.preferences?.language);
  const items = canViewAdminDashboard(user) ? [...nav, supportNav, adminNav] : nav;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <nav className="main-nav" aria-label={t("nav.mainMenu")}>
        {items.map(([labelKey, href, icon]) => (
          <Link className={activeHref === href ? "nav-link active" : "nav-link"} href={href} key={href}>
            <span aria-hidden="true"><Icon name={icon} /></span>{t(labelKey)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
