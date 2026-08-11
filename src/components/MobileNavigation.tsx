"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";

type NavigationItem = {
  href: string;
  icon: string;
  label: string;
};

export function MobileNavigation({
  closeLabel,
  items,
  menuLabel,
}: {
  closeLabel: string;
  items: NavigationItem[];
  menuLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="mobile-navigation">
      <button
        aria-controls={isOpen ? "mobile-main-navigation" : undefined}
        aria-expanded={isOpen}
        aria-label={menuLabel}
        className="mobile-nav-trigger"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Icon name="menu" />
      </button>

      {isOpen ? (
        <>
          <button
            aria-label={closeLabel}
            className="mobile-nav-backdrop"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside aria-label={menuLabel} className="mobile-nav-panel" id="mobile-main-navigation">
            <div className="mobile-nav-header">
              <Brand />
              <button aria-label={closeLabel} className="mobile-nav-close" onClick={() => setIsOpen(false)} type="button">
                <Icon name="close" />
              </button>
            </div>
            <nav className="mobile-nav-links">
              {items.map((item) => (
                <Link
                  className={pathname === item.href ? "mobile-nav-link active" : "mobile-nav-link"}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  <span aria-hidden="true"><Icon name={item.icon} /></span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </>
      ) : null}
    </div>
  );
}
