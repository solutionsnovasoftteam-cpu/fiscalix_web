"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import { paginateItems, paginationRangeLabel, TABLE_PAGE_SIZE } from "@/lib/pagination";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";

export type ActivityRow = {
  action: string;
  date: string;
  description: string;
  id: string;
  module: string;
  user: string;
};

export type SettingsInitialData = {
  activity: ActivityRow[];
  userName: string;
};

const quickLinks = [
  { href: "/companies", id: "company", icon: "business", titleKey: "nav.company", textKey: "settings.companyText" },
  { href: "/profile", id: "profile", icon: "manage_accounts", titleKey: "settings.profile", textKey: "settings.profileText" },
] as const;

export function SettingsHub({
  initialData,
  language = "es",
}: {
  initialData?: SettingsInitialData;
  language?: FiscalixLanguage;
}) {
  const t = createTranslator(language);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [activityPageNumber, setActivityPageNumber] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const activity = useMemo(() => initialData?.activity ?? [], [initialData?.activity]);

  const filteredActivity = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return activity;
    return activity.filter((row) =>
      [row.date, row.user, row.action, row.module, row.description].join(" ").toLowerCase().includes(term),
    );
  }, [activity, query]);
  const activityPage = useMemo(() => paginateItems(filteredActivity, activityPageNumber, TABLE_PAGE_SIZE), [activityPageNumber, filteredActivity]);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  }

  return (
    <div className="settings-page">
      {feedback && (
        <div className="settings-feedback" role="status">
          <Icon name="check_circle" />
          {feedback}
        </div>
      )}

      <header className="settings-header">
        <div>
          <p className="settings-eyebrow">{t("settings.eyebrow")}</p>
          <h1>{t("settings.title")}</h1>
          <span>{t("settings.description")}</span>
        </div>
        <div className="settings-header-actions">
          <label className="settings-search">
            <Icon name="search" />
            <input
              onChange={(event) => {
                setQuery(event.target.value);
                setActivityPageNumber(1);
              }}
              placeholder={t("settings.searchPlaceholder")}
              type="search"
              value={query}
            />
          </label>
        </div>
      </header>

      <section className="settings-quick" aria-label={t("settings.quickLinks")}>
        {quickLinks.map((link) => (
          <a className="settings-quick-card" href={link.href} key={link.id}>
            <span><Icon name={link.icon} /></span>
            <strong>{t(link.titleKey)}</strong>
            <small>{t(link.textKey)}</small>
            <em>{t("settings.open")} <Icon name="arrow_forward" /></em>
          </a>
        ))}
      </section>

      <section className="settings-panel settings-activity">
        <div className="settings-panel-head">
          <div>
            <h2>{t("settings.activityTitle")}</h2>
            <p>{t("settings.activityHelp")}</p>
          </div>
          <span className="receipts-count">{filteredActivity.length} {filteredActivity.length === 1 ? t("income.record") : t("income.records")}</span>
        </div>
        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>{t("table.date")}</th>
                <th>{t("settings.user")}</th>
                <th>{t("settings.action")}</th>
                <th>{t("settings.module")}</th>
                <th>{t("table.description")}</th>
                <th aria-label={t("table.actions")} />
              </tr>
            </thead>
            <tbody>
              {filteredActivity.length === 0 ? (
                <tr>
                  <td className="settings-empty" colSpan={6}>{t("settings.noActivitySearch")}</td>
                </tr>
              ) : (
                activityPage.items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.user}</td>
                    <td>{row.action}</td>
                    <td>{row.module}</td>
                    <td>{row.description}</td>
                    <td className="settings-row-menu">
                      <button
                        aria-label={t("settings.optionsFor", { action: row.action })}
                        className="settings-icon-btn"
                        onClick={() => setMenuOpenId((current) => (current === row.id ? null : row.id))}
                        type="button"
                      >
                        <Icon name="more_horiz" />
                      </button>
                      {menuOpenId === row.id && (
                        <div className="settings-menu">
                          <button onClick={() => { setMenuOpenId(null); notify(t("settings.detailRegistered", { action: row.action })); }} type="button">
                            {t("settings.detail")}
                          </button>
                          <button onClick={() => { setMenuOpenId(null); notify(t("settings.recordExported")); }} type="button">
                            {t("settings.export")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredActivity.length > TABLE_PAGE_SIZE && (
          <nav className="table-pagination" aria-label={t("pagination.label")}>
            <span>{t("pagination.showing", { range: paginationRangeLabel(filteredActivity.length, activityPage.start, activityPage.end, language) })}</span>
            <div>
              <button disabled={activityPage.currentPage === 1} onClick={() => setActivityPageNumber((value) => Math.max(1, value - 1))} type="button">
                <Icon name="chevron_left" />
              </button>
              {Array.from({ length: activityPage.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  className={pageNumber === activityPage.currentPage ? "is-active" : undefined}
                  key={pageNumber}
                  onClick={() => setActivityPageNumber(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              ))}
              <button disabled={activityPage.currentPage === activityPage.totalPages} onClick={() => setActivityPageNumber((value) => Math.min(activityPage.totalPages, value + 1))} type="button">
                <Icon name="chevron_right" />
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
