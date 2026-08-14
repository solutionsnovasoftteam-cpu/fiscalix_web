"use client";

import { jsPDF } from "jspdf";
import { useState } from "react";
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
import type { ReceiptDetail } from "@/app/receipts/receipts-table-actions";

function formatDate(value: string, preferences: UserPreferences) {
  return formatPreferenceDate(value, preferences, createTranslator(preferences.language)("common.noDate"));
}

function rangeLabel(from: string, to: string, preferences: UserPreferences, t: ReturnType<typeof createTranslator>) {
  if (from && to) return `${formatDate(from, preferences)} — ${formatDate(to, preferences)}`;
  if (from) return `${t("receipts.from")} ${formatDate(from, preferences)}`;
  if (to) return `${t("receipts.to")} ${formatDate(to, preferences)}`;
  return t("receipts.allDates");
}

function downloadReceiptsPdf(
  receipts: ReceiptDetail[],
  from: string,
  to: string,
  preferences: UserPreferences,
  t: ReturnType<typeof createTranslator>,
) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  function drawPageBase() {
    doc.setFillColor(244, 247, 250);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFillColor(19, 30, 41);
    doc.rect(0, 0, pageWidth, 39, "F");
    doc.setFillColor(1, 195, 141);
    doc.rect(0, 36.5, pageWidth, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("FISCALIX", margin, 17);
    doc.setFontSize(8);
    doc.setTextColor(196, 206, 221);
    doc.text("CONTABILIDAD SIMPLIFICADA", margin, 23.5);
    doc.setFontSize(12);
    doc.setTextColor(1, 195, 141);
    doc.text(t("receipts.exportTitle").toUpperCase(), pageWidth - margin, 16, { align: "right" });
  }

  function drawTableHeader(y: number) {
    doc.setFillColor(19, 45, 70);
    doc.roundedRect(margin, y, contentWidth, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(238, 245, 251);
    doc.text(t("table.folio").toUpperCase(), margin + 4, y + 5.8);
    doc.text(t("table.date").toUpperCase(), margin + 39, y + 5.8);
    doc.text(t("table.company").toUpperCase(), margin + 64, y + 5.8);
    doc.text(t("table.concept").toUpperCase(), margin + 107, y + 5.8);
    doc.text(t("table.type").toUpperCase(), margin + 150, y + 5.8);
    doc.text(t("table.amount").toUpperCase(), pageWidth - margin - 4, y + 5.8, { align: "right" });
  }

  drawPageBase();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(97, 109, 124);
  doc.text(`${t("receipts.exportPeriod")} · ${rangeLabel(from, to, preferences, t)}`, margin, 51);
  doc.text(`${t("receipts.exportGenerated")} · ${formatPreferenceDateTime(new Date().toISOString(), preferences)}`, margin, 57);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(19, 45, 70);
  doc.text(`${receipts.length} ${t(receipts.length === 1 ? "receipts.singleResult" : "receipts.multipleResults")}`, pageWidth - margin, 53, { align: "right" });

  let y = 67;
  drawTableHeader(y);
  y += 14;

  receipts.forEach((receipt, index) => {
    const company = doc.splitTextToSize(receipt.company, 37).slice(0, 2);
    const concept = doc.splitTextToSize(receipt.concept, 39).slice(0, 2);
    const rowHeight = Math.max(11, company.length * 3.8 + 4, concept.length * 3.8 + 4);
    if (y + rowHeight > pageHeight - 25) {
      doc.addPage();
      drawPageBase();
      y = 22;
      drawTableHeader(y);
      y += 14;
    }

    doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    doc.roundedRect(margin, y - 4, contentWidth, rowHeight, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(19, 45, 70);
    doc.text(receipt.folio, margin + 4, y + 2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(97, 109, 124);
    doc.text(formatDate(receipt.date, preferences), margin + 39, y + 2);
    doc.text(company, margin + 64, y + 2);
    doc.text(concept, margin + 107, y + 2);
    doc.text(receipt.type === "Ingreso" ? t("dashboard.income") : t("dashboard.expenses"), margin + 150, y + 2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(receipt.type === "Ingreso" ? 0 : 201, receipt.type === "Ingreso" ? 139 : 125, receipt.type === "Ingreso" ? 101 : 41);
    doc.text(formatPreferenceMoney(receipt.amount, preferences), pageWidth - margin - 4, y + 2, { align: "right" });
    y += rowHeight + 1;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(97, 109, 124);
  doc.text("Documento de control interno generado por Fiscalix.", pageWidth / 2, pageHeight - 12, { align: "center" });
  doc.save("comprobantes-fiscalix.pdf");
}

export function ReceiptsExportButton({ preferences, receipts }: { preferences: UserPreferences; receipts: ReceiptDetail[] }) {
  const t = createTranslator(preferences.language);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  function close() {
    if (!isGenerating) {
      setError("");
      setIsOpen(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const from = String(form.get("from") ?? "");
    const to = String(form.get("to") ?? "");
    if (from && to && from > to) {
      setError(t("receipts.invalidDateRange"));
      return;
    }
    const selected = receipts.filter((receipt) => (!from || receipt.date >= from) && (!to || receipt.date <= to));
    if (!selected.length) {
      setError(t("receipts.noExportResults"));
      return;
    }

    setIsGenerating(true);
    try {
      downloadReceiptsPdf(selected, from, to, preferences, t);
      await notifyPdfDownload("receipt", { recordCount: selected.length });
      setIsOpen(false);
      setError("");
    } finally {
      setIsGenerating(false);
    }
  }

  const modal = isOpen ? (
    <div className="receipts-detail-backdrop" onMouseDown={close} role="presentation">
      <section aria-modal="true" className="receipts-detail-modal receipts-export-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-labelledby="receipts-export-title">
        <header>
          <div>
            <p>{t("receipts.exportEyebrow")}</p>
            <h2 id="receipts-export-title">{t("receipts.exportTitle")}</h2>
            <span>{t("receipts.exportHelp")}</span>
          </div>
          <button aria-label={t("button.close")} onClick={close} type="button"><Icon name="close" /></button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="receipts-export-fields">
            <label>{t("receipts.from")}<input name="from" type="date" /></label>
            <label>{t("receipts.to")}<input name="to" type="date" /></label>
          </div>
          <p>{t("receipts.openRangeHelp")}</p>
          {error && <div className="receipts-export-error" role="alert">{error}</div>}
          <footer>
            <button onClick={close} type="button">{t("button.cancel")}</button>
            <button className="primary-button compact" disabled={isGenerating} type="submit"><Icon name="download" /> {isGenerating ? t("common.loading") : t("button.downloadPdf")}</button>
          </footer>
        </form>
      </section>
    </div>
  ) : null;

  return <>
    <button className="receipts-new" onClick={() => setIsOpen(true)} type="button"><Icon name="download" /> {t("receipts.downloadList")}</button>
    {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
  </>;
}
