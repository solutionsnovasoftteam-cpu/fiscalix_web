import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { getNavigationItems } from "@/components/navigation";
import { createTranslator } from "@/lib/i18n";
import type { FiscalixUser } from "@/models/User";

export function Sidebar({ activeHref = "/dashboard", user }: { activeHref?: string; user: FiscalixUser }) {
  const t = createTranslator(user.preferences?.language);
  const items = getNavigationItems(user);

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
