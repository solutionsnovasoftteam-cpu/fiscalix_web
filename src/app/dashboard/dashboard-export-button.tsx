"use client";

import { jsPDF } from "jspdf";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { notifyPdfDownload } from "@/lib/clientNotifications";
import fiscalixLogo from "../../../logo-fiscalix.png";

export type DashboardExportData = {
  generatedFor: string;
  monthlySummary: Array<{
    expenses: number;
    incomes: number;
    key: string;
    label: string;
  }>;
  movements: Array<{
    amount: number;
    company: string;
    concept: string;
    date: string;
    id: string;
    tone: "negative" | "positive";
    type: "Gasto" | "Ingreso";
  }>;
  obligations: Array<{
    description: string;
    id: string;
    meta: string;
    title: string;
  }>;
  stats: Array<{
    help: string;
    title: string;
    value: string;
  }>;
};

const money = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const dateLabel = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const C = {
  amber: [255, 139, 105] as [number, number, number],
  deep: [19, 45, 70] as [number, number, number],
  green: [1, 195, 141] as [number, number, number],
  greenDark: [0, 169, 121] as [number, number, number],
  muted: [97, 109, 124] as [number, number, number],
  navy: [25, 30, 41] as [number, number, number],
  page: [244, 247, 250] as [number, number, number],
  panel: [19, 36, 51] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateLabel.format(date);
}

function loadLogoDataUrl(src: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("No se pudo preparar el logo."));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("No se pudo cargar el logo."));
    image.src = src;
  });
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const footerTop = pageHeight - 18;
  doc.setFillColor(...C.navy);
  doc.rect(0, footerTop, pageWidth, 18, "F");
  doc.setFillColor(...C.green);
  doc.rect(0, footerTop, pageWidth, 1.2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(159, 176, 192);
  doc.text("Documento generado por Fiscalix · Resumen ejecutivo del dashboard", pageWidth / 2, footerTop + 9, { align: "center" });
}

function drawBase(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.setFillColor(...C.page);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  drawFooter(doc, pageWidth, pageHeight);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.navy);
  doc.text(title, 15, y);
  doc.setDrawColor(...C.greenDark);
  doc.setLineWidth(0.5);
  doc.line(15, y + 2, 52, y + 2);
}

function ensureSpace(doc: jsPDF, y: number, needed: number, pageWidth: number, pageHeight: number) {
  if (y + needed < pageHeight - 24) return y;
  doc.addPage();
  drawBase(doc, pageWidth, pageHeight);
  return 22;
}

function drawMetricCards(doc: jsPDF, data: DashboardExportData, pageWidth: number, startY: number) {
  const margin = 15;
  const gap = 6;
  const cardWidth = (pageWidth - margin * 2 - gap) / 2;
  const cardHeight = 27;

  data.stats.forEach((stat, index) => {
    const x = margin + (index % 2) * (cardWidth + gap);
    const y = startY + Math.floor(index / 2) * (cardHeight + gap);

    doc.setFillColor(...C.panel);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "F");
    doc.setFillColor(...C.green);
    doc.roundedRect(x, y, 3, cardHeight, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(167, 179, 198);
    doc.text(stat.title.toUpperCase(), x + 7, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...C.white);
    doc.text(stat.value, x + 7, y + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(167, 179, 198);
    doc.text(doc.splitTextToSize(stat.help, cardWidth - 14).slice(0, 1), x + 7, y + 23);
  });

  return startY + cardHeight * 2 + gap + 5;
}

function drawMonthlyChart(doc: jsPDF, data: DashboardExportData, pageWidth: number, startY: number) {
  const rows = data.monthlySummary;
  const margin = 15;
  const chartX = margin + 22;
  const chartY = startY + 8;
  const chartWidth = pageWidth - margin * 2 - 28;
  const chartHeight = 48;
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.incomes, row.expenses]));
  const divisor = Math.max(1, rows.length - 1);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, startY, pageWidth - margin * 2, 72, 3, 3, "F");
  doc.setDrawColor(224, 231, 239);
  doc.setLineWidth(0.2);

  [0, 0.5, 1].forEach((ratio) => {
    const y = chartY + chartHeight * ratio;
    doc.line(chartX, y, chartX + chartWidth, y);
  });

  const incomePoints = rows.map((row, index) => ({
    x: chartX + (chartWidth / divisor) * index,
    y: chartY + chartHeight - (row.incomes / maxValue) * chartHeight,
  }));
  const expensePoints = rows.map((row, index) => ({
    x: chartX + (chartWidth / divisor) * index,
    y: chartY + chartHeight - (row.expenses / maxValue) * chartHeight,
  }));

  doc.setLineWidth(1.2);
  doc.setDrawColor(...C.green);
  incomePoints.forEach((point, index) => {
    if (index === 0) return;
    const previous = incomePoints[index - 1];
    doc.line(previous.x, previous.y, point.x, point.y);
  });
  doc.setDrawColor(...C.amber);
  expensePoints.forEach((point, index) => {
    if (index === 0) return;
    const previous = expensePoints[index - 1];
    doc.line(previous.x, previous.y, point.x, point.y);
  });

  rows.forEach((row, index) => {
    const x = chartX + (chartWidth / divisor) * index;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(row.label, x, chartY + chartHeight + 8, { align: "center" });
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(money.format(maxValue), margin + 4, chartY + 2);
  doc.text("$0.00", margin + 4, chartY + chartHeight + 2);
  doc.setFillColor(...C.green);
  doc.rect(pageWidth - margin - 58, startY + 8, 6, 2, "F");
  doc.setTextColor(...C.navy);
  doc.text("Ingresos", pageWidth - margin - 49, startY + 10);
  doc.setFillColor(...C.amber);
  doc.rect(pageWidth - margin - 28, startY + 8, 6, 2, "F");
  doc.text("Gastos", pageWidth - margin - 19, startY + 10);

  return startY + 82;
}

function drawSimpleList(
  doc: jsPDF,
  title: string,
  emptyText: string,
  items: Array<{ left: string; right?: string; sub?: string }>,
  startY: number,
  pageWidth: number,
  pageHeight: number,
) {
  let y = ensureSpace(doc, startY, 24, pageWidth, pageHeight);
  drawSectionTitle(doc, title, y);
  y += 9;

  if (!items.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.muted);
    doc.text(emptyText, 15, y + 6);
    return y + 18;
  }

  for (const item of items) {
    y = ensureSpace(doc, y, 18, pageWidth, pageHeight);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(15, y, pageWidth - 30, 15, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...C.navy);
    doc.text(doc.splitTextToSize(item.left, 105).slice(0, 1), 20, y + 6);
    if (item.right) {
      doc.text(item.right, pageWidth - 20, y + 6, { align: "right" });
    }
    if (item.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(...C.muted);
      doc.text(doc.splitTextToSize(item.sub, pageWidth - 40).slice(0, 1), 20, y + 11.5);
    }
    y += 18;
  }

  return y + 3;
}

async function downloadDashboardPdf(data: DashboardExportData) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const generatedAt = new Date();

  drawBase(doc, pageWidth, pageHeight);

  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setFillColor(...C.deep);
  doc.rect(0, 39, pageWidth, 3, "F");

  try {
    const logo = await loadLogoDataUrl(fiscalixLogo.src);
    doc.setFillColor(...C.white);
    doc.roundedRect(margin, 9, 58, 18, 3, 3, "F");
    doc.addImage(logo, "PNG", margin + 5, 12, 48, 12);
  } catch {
    doc.setFillColor(...C.white);
    doc.roundedRect(margin, 9, 58, 18, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...C.navy);
    doc.text("Fiscalix", margin + 8, 21);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.green);
  doc.text("RESUMEN GENERAL", pageWidth - margin, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(159, 176, 192);
  doc.text(`Usuario · ${data.generatedFor}`, pageWidth - margin, 23, { align: "right" });
  doc.text(`Generado · ${dateLabel.format(generatedAt)}`, pageWidth - margin, 30, { align: "right" });

  let y = 54;
  drawSectionTitle(doc, "Indicadores principales", y);
  y = drawMetricCards(doc, data, pageWidth, y + 8);

  y = ensureSpace(doc, y, 88, pageWidth, pageHeight);
  drawSectionTitle(doc, "Resumen financiero de los últimos 6 meses", y);
  y = drawMonthlyChart(doc, data, pageWidth, y + 7);

  y = drawSimpleList(
    doc,
    "Próximas obligaciones",
    "No hay obligaciones próximas registradas.",
    data.obligations.map((item) => ({
      left: item.title,
      right: item.meta,
      sub: item.description,
    })),
    y,
    pageWidth,
    pageHeight,
  );

  drawSimpleList(
    doc,
    "Movimientos recientes",
    "No hay movimientos recientes registrados.",
    data.movements.map((movement) => ({
      left: `${movement.type}: ${movement.concept}`,
      right: `${movement.tone === "positive" ? "+" : "-"}${money.format(movement.amount)}`,
      sub: `${movement.company} · ${formatDate(movement.date)}`,
    })),
    y,
    pageWidth,
    pageHeight,
  );

  doc.save(`dashboard-fiscalix-${localDateKey()}.pdf`);
}

export function DashboardExportButton({ data }: { data: DashboardExportData }) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 3200);
  }

  async function exportDashboard() {
    setExporting(true);
    setMessage("");

    try {
      await downloadDashboardPdf(data);
      await notifyPdfDownload("dashboard");
      notify("PDF del dashboard generado.");
    } catch {
      notify("No fue posible generar el PDF del dashboard.");
    } finally {
      setExporting(false);
    }
  }

  const portalTarget = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <button className="primary-button compact" disabled={exporting} onClick={exportDashboard} type="button">
        <Icon name="picture_as_pdf" /> {exporting ? "Generando..." : "Exportar PDF"}
      </button>
      {portalTarget && message ? createPortal(<div className="expenses-action-toast" role="status">{message}</div>, portalTarget) : null}
    </>
  );
}
