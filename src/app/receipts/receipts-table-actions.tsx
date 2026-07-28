"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import {
  formatPreferenceDate,
  formatPreferenceMoney,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

export type ReceiptDetail = {
  amount: number;
  company: string;
  concept: string;
  date: string;
  folio: string;
  id: string;
  type: "Gasto" | "Ingreso";
};

function formatDate(value: string, preferences: UserPreferences) {
  return formatPreferenceDate(value, preferences, createTranslator(preferences.language)("common.noDate"));
}

export function ReceiptsTableActions({
  preferences,
  receipt,
}: {
  preferences: UserPreferences;
  receipt: ReceiptDetail;
}) {
  const t = createTranslator(preferences.language);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [open]);

  const modal = open ? (
    <div
      className="receipts-detail-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      role="presentation"
    >
      <section
        aria-labelledby={`receipt-detail-title-${receipt.id}`}
        aria-modal="true"
        className="receipts-detail-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <div>
            <p>{t("receipts.detail")}</p>
            <h2 id={`receipt-detail-title-${receipt.id}`}>{receipt.folio}</h2>
            <span>{t("receipts.detailHelp")}</span>
          </div>
          <button aria-label={t("button.close")} onClick={() => setOpen(false)} type="button">
            <Icon name="close" />
          </button>
        </header>

        <div className="receipts-detail-body">
          <div className={receipt.type === "Ingreso" ? "receipts-detail-total income" : "receipts-detail-total expense"}>
            <small>{t("table.amount")}</small>
            <strong>{formatPreferenceMoney(receipt.amount, preferences)}</strong>
            <span>{receipt.type === "Ingreso" ? t("dashboard.income") : t("dashboard.expenses")}</span>
          </div>

          <dl className="receipts-detail-list">
            <div>
              <dt>{t("table.company")}</dt>
              <dd>{receipt.company}</dd>
            </div>
            <div>
              <dt>{t("table.concept")}</dt>
              <dd>{receipt.concept}</dd>
            </div>
            <div>
              <dt>{t("table.date")}</dt>
              <dd>{formatDate(receipt.date, preferences)}</dd>
            </div>
            <div>
              <dt>{t("table.status")}</dt>
              <dd><span className="receipt-status"><i />{t("common.registered")}</span></dd>
            </div>
            <div>
              <dt>{t("receipts.internalId")}</dt>
              <dd>{receipt.id}</dd>
            </div>
          </dl>
        </div>

        <footer>
          <button className="receipts-detail-close" onClick={() => setOpen(false)} type="button">
            {t("button.close")}
          </button>
        </footer>
      </section>
    </div>
  ) : null;
  const modalPortal = modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null;

  return (
    <>
      <span className="receipt-actions">
        <button aria-label={t("receipts.viewDetail", { folio: receipt.folio })} className="receipt-action" onClick={() => setOpen(true)} type="button">
          <Icon name="search" />
        </button>
        <button
          aria-label={t("receipts.moreSoon", { folio: receipt.folio })}
          className="receipt-action"
          disabled
          title={t("receipts.moreActionsSoon")}
          type="button"
        >
          <Icon name="more_horiz" />
        </button>
      </span>
      {modalPortal}
    </>
  );
}
