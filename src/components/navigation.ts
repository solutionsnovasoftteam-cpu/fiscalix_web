import { canViewAdminDashboard } from "@/lib/roles";
import type { FiscalixUser } from "@/models/User";

export const navigationItems = [
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

const adminNavigationItem = ["nav.admin", "/admin", "manage_accounts"] as const;
const supportNavigationItem = ["nav.clarifications", "/support", "support_agent"] as const;

export function getNavigationItems(user: FiscalixUser) {
  return canViewAdminDashboard(user)
    ? [...navigationItems, supportNavigationItem, adminNavigationItem]
    : navigationItems;
}
