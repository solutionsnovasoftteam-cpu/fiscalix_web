"use client";

import { jsPDF } from "jspdf";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { notifyPdfDownload } from "@/lib/clientNotifications";
import { createTranslator } from "@/lib/i18n";
import {
  formatPreferenceDate,
  formatPreferenceDateTime,
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

const INCOME_ACCENT: [number, number, number] = [0, 169, 121];
const EXPENSE_ACCENT: [number, number, number] = [201, 125, 41];

function formatDate(value: string, preferences: UserPreferences) {
  return formatPreferenceDate(value, preferences, createTranslator(preferences.language)("common.noDate"));
}

function downloadReceiptPdf(
  receipt: ReceiptDetail,
  preferences: UserPreferences,
  t: ReturnType<typeof createTranslator>,
) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const isIncome = receipt.type === "Ingreso";
  const accent = isIncome ? INCOME_ACCENT : EXPENSE_ACCENT;

  doc.setFillColor(19, 30, 41);
  doc.rect(0, 0, pageWidth, 48, "F");
  doc.setFillColor(...accent);
  doc.rect(0, 45, pageWidth, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text("FISCALIX", margin, 20);
  doc.setFontSize(9);
  doc.setTextColor(196, 206, 221);
  doc.text("CONTABILIDAD SIMPLIFICADA", margin, 27);
  doc.setFontSize(12);
  doc.setTextColor(...accent);
  doc.text("COMPROBANTE", pageWidth - margin, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(196, 206, 221);
  doc.text(`Generado · ${formatPreferenceDateTime(new Date().toISOString(), preferences)}`, pageWidth - margin, 27, { align: "right" });

  doc.setFillColor(244, 247, 250);
  doc.roundedRect(margin, 61, contentWidth, 38, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(97, 109, 124);
  doc.text(t("table.folio").toUpperCase(), margin + 8, 73);
  doc.setFontSize(17);
  doc.setTextColor(19, 45, 70);
  doc.text(receipt.folio, margin + 8, 84);
  doc.setFontSize(8);
  doc.setTextColor(97, 109, 124);
  doc.text(t("table.amount").toUpperCase(), pageWidth - margin - 8, 73, { align: "right" });
  doc.setFontSize(17);
  doc.setTextColor(...accent);
  doc.text(formatPreferenceMoney(receipt.amount, preferences), pageWidth - margin - 8, 84, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(97, 109, 124);
  doc.text(isIncome ? t("dashboard.income") : t("dashboard.expenses"), pageWidth - margin - 8, 92, { align: "right" });

  const fields = [
    [t("table.company"), receipt.company],
    [t("table.concept"), receipt.concept],
    [t("table.date"), formatDate(receipt.date, preferences)],
    [t("table.status"), t("common.registered")],
  ] as const;

  const y = 116;
  fields.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * (contentWidth / 2 + 4);
    const width = contentWidth / 2 - 4;
    const fieldY = y + row * 31;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(224, 231, 239);
    doc.roundedRect(x, fieldY, width, 25, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(97, 109, 124);
    doc.text(label.toUpperCase(), x + 5, fieldY + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(19, 45, 70);
    doc.text(doc.splitTextToSize(value, width - 10).slice(0, 2), x + 5, fieldY + 16);
  });

  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(margin, 190, pageWidth - margin, 190);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(97, 109, 124);
  doc.text("Documento de control interno generado por Fiscalix.", pageWidth / 2, 199, { align: "center" });
  doc.save(`${receipt.folio.toLowerCase()}-fiscalix.pdf`);
}

export function ReceiptsTableActions({
  preferences,
  receipt,
}: {
  preferences: UserPreferences;
  receipt: ReceiptDetail;
}) {
  const t = createTranslator(preferences.language);
  const [downloading, setDownloading] = useState(false);
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

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      downloadReceiptPdf(receipt, preferences, t);
      await notifyPdfDownload("receipt", { folio: receipt.folio, recordCount: 1 });
    } finally {
      setDownloading(false);
    }
  }

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
          aria-label={`${t("button.downloadPdf")}: ${receipt.folio}`}
          className="receipt-action"
          disabled={downloading}
          onClick={handleDownload}
          title={t("button.downloadPdf")}
          type="button"
        >
          <Icon name="download" />
        </button>
      </span>
      {modalPortal}
    </>
  );
}
