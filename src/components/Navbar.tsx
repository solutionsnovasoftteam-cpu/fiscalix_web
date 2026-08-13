import Link from "next/link";
import { Icon } from "@/components/Icon";
import { MobileNavigation } from "@/components/MobileNavigation";
import { getNavigationItems } from "@/components/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { UserAvatar } from "@/components/UserAvatar";
import type { FiscalixUser } from "@/models/User";
import { createTranslator } from "@/lib/i18n";
import { initials } from "@/lib/utils";

export function Navbar({ user }: { user: FiscalixUser }) {
  const t = createTranslator(user.preferences?.language);
  const navigationItems = getNavigationItems(user).map(([labelKey, href, icon]) => ({
    href,
    icon,
    label: t(labelKey),
  }));

  return (
    <header className="topbar">
      <div className="topbar-start">
        <MobileNavigation closeLabel={t("button.close")} items={navigationItems} menuLabel={t("nav.mainMenu")} />
        <label className="search"><Icon name="search" /><input aria-label={t("button.search")} placeholder={t("nav.search")} /></label>
      </div>
      <div className="topbar-actions">
        <NotificationBell language={user.preferences?.language} />
        <Link className="avatar small profile-link" href="/profile" aria-label={t("nav.goProfile")} title={t("nav.myProfile")}>
          <UserAvatar avatarUrl={user.avatar_url} fallback={initials(user.nombre, user.apellido)} />
        </Link>
      </div>
    </header>
  );
}
