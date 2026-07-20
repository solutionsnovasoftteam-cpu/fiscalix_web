import { jsPDF } from "jspdf";
import fiscalixLogo from "../../../logo-fiscalix.png";
import type { PayrollRun } from "@/app/payroll/payroll-dates";

const money = new Intl.NumberFormat("es-MX", { currency: "MXN", style: "currency" });
const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const C = {
  navy: [25, 30, 41] as [number, number, number],
  deep: [19, 45, 70] as [number, number, number],
  green: [1, 195, 141] as [number, number, number],
  greenDark: [0, 169, 121] as [number, number, number],
  mint: [87, 243, 199] as [number, number, number],
  text: [238, 245, 251] as [number, number, number],
  muted: [159, 176, 192] as [number, number, number],
  panel: [19, 36, 51] as [number, number, number],
  panelLight: [30, 45, 60] as [number, number, number],
  page: [244, 247, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

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

function drawDarkCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  accent = false,
) {
  doc.setFillColor(...C.panel);
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  if (accent) {
    doc.setFillColor(...C.green);
    doc.roundedRect(x, y, width, 2.2, 1.2, 1.2, "F");
  }
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 3, 3, "S");
}

function drawLightCard(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setFillColor(...C.white);
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 3, 3, "S");
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  valueSize = 11,
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(valueSize);
  doc.setTextColor(...C.text);
  doc.text(value, x, y + 6.5, { maxWidth: width });
}

function drawStatusBadge(doc: jsPDF, status: string, x: number, y: number) {
  const isPaid = status === "Pagado";
  doc.setFillColor(...(isPaid ? C.green : [245, 158, 11] as [number, number, number]));
  doc.roundedRect(x, y, 24, 8, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.navy);
  doc.text(status.toUpperCase(), x + 12, y + 5.5, { align: "center" });
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number) {
  const footerTop = pageHeight - 28;

  doc.setFillColor(...C.navy);
  doc.rect(0, footerTop, pageWidth, 28, "F");
  doc.setFillColor(...C.green);
  doc.rect(0, footerTop, pageWidth, 1.2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(
    "Documento generado por Fiscalix · Plataforma fiscal y de nómina",
    pageWidth / 2,
    footerTop + 11,
    { align: "center" },
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.mint);
  doc.text("www.fiscalix.mx", pageWidth / 2, footerTop + 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 135, 150);
  doc.text("Comprobante válido para control interno y respaldo de dispersión.", margin, footerTop + 24);
}

export async function downloadPayrollPdf(run: PayrollRun) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(...C.page);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pageWidth, 48, "F");
  doc.setFillColor(...C.deep);
  doc.rect(0, 44, pageWidth, 4, "F");

  doc.setFillColor(...C.green);
  doc.circle(pageWidth - 18, 10, 16, "F");
  doc.setFillColor(...C.navy);
  doc.circle(pageWidth - 18, 10, 11, "F");

  try {
    const logo = await loadLogoDataUrl(fiscalixLogo.src);
    doc.setFillColor(...C.white);
    doc.roundedRect(margin, 10, 62, 20, 3, 3, "F");
    doc.setDrawColor(...C.green);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, 10, 62, 20, 3, 3, "S");
    doc.addImage(logo, "PNG", margin + 5, 13.5, 52, 13);
  } catch {
    doc.setFillColor(...C.white);
    doc.roundedRect(margin, 10, 62, 20, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...C.navy);
    doc.text("Fiscalix", margin + 8, 23);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.mint);
  doc.text("COMPROBANTE DE NÓMINA", pageWidth - margin, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text(`Generado · ${dateFmt.format(new Date())}`, pageWidth - margin, 25, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text("Tu contabilidad simplificada", pageWidth - margin, 30, { align: "right" });

  const infoTop = 58;
  drawDarkCard(doc, margin, infoTop, contentWidth, 36, true);
  drawLabelValue(doc, "Folio", run.folio, margin + 10, infoTop + 10, 44);
  drawLabelValue(doc, "Periodo", run.period, margin + 58, infoTop + 10, 58);
  drawLabelValue(
    doc,
    "Fecha de pago",
    dateFmt.format(new Date(`${run.payDate}T12:00:00`)),
    margin + 10,
    infoTop + 24,
    58,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text("ESTADO", margin + 118, infoTop + 17.5);
  drawStatusBadge(doc, run.status, margin + 118, infoTop + 20);

  const summaryTop = 102;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.navy);
  doc.text("Resumen de dispersión", margin, summaryTop);
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.8);
  doc.line(margin, summaryTop + 2, margin + 42, summaryTop + 2);

  const cards = [
    { label: "Empleados", value: String(run.employees) },
    { label: "Percepciones", value: money.format(run.perceptions) },
    { label: "Deducciones", value: money.format(run.deductions) },
    { label: "Total pagado", value: money.format(run.paid) },
  ];

  const cardWidth = (contentWidth - 10) / 2;
  const cardHeight = 20;
  cards.forEach((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + col * (cardWidth + 10);
    const y = summaryTop + 8 + row * (cardHeight + 8);
    drawDarkCard(doc, x, y, cardWidth, cardHeight, true);
    drawLabelValue(doc, card.label, card.value, x + 8, y + 5, cardWidth - 16, index === 3 ? 11 : 10);
  });

  const detailTop = summaryTop + 8 + 2 * (cardHeight + 8) + 8;
  const detailCardTop = detailTop + 8;
  const totalTop = detailCardTop + 38;
  const stampTop = totalTop + 26;
  const footerTop = pageHeight - 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.navy);
  doc.text("Detalle financiero", margin, detailTop);
  doc.setDrawColor(...C.green);
  doc.line(margin, detailTop + 2, margin + 34, detailTop + 2);

  drawLightCard(doc, margin, detailCardTop, contentWidth, 32);

  const rows = [
    { label: "Percepciones totales", value: money.format(run.perceptions), accent: false },
    { label: "Deducciones aplicadas", value: `-${money.format(run.deductions)}`, accent: false },
    { label: "Neto dispersado", value: money.format(run.paid), accent: true },
  ];

  rows.forEach((row, index) => {
    const y = detailCardTop + 10 + index * 10;
    if (index > 0) {
      doc.setDrawColor(220, 228, 235);
      doc.setLineWidth(0.15);
      doc.line(margin + 8, y - 4, margin + contentWidth - 8, y - 4);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.navy);
    doc.text(row.label, margin + 10, y);
    doc.setFont("helvetica", row.accent ? "bold" : "normal");
    doc.setFontSize(row.accent ? 12 : 10);
    doc.setTextColor(...(row.accent ? C.greenDark : C.navy));
    doc.text(row.value, pageWidth - margin - 10, y, { align: "right" });
  });

  doc.setFillColor(...C.green);
  doc.roundedRect(margin, totalTop, contentWidth, 22, 4, 4, "F");
  doc.setFillColor(...C.greenDark);
  doc.roundedRect(margin + contentWidth - 48, totalTop + 4, 40, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.navy);
  doc.text("Total neto a dispersar", margin + 10, totalTop + 10);
  doc.setFontSize(16);
  doc.text(money.format(run.paid), pageWidth - margin - 10, totalTop + 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.navy);
  doc.text(`${run.employees} colaboradores · ${run.period}`, margin + 10, totalTop + 18);

  drawLightCard(doc, margin, stampTop, contentWidth, 18);
  doc.setFillColor(...C.green);
  doc.circle(margin + 14, stampTop + 9, 5.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.navy);
  doc.text("OK", margin + 12.3, stampTop + 10.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.navy);
  doc.text("Nómina registrada en Fiscalix", margin + 24, stampTop + 8.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 105, 120);
  doc.text(
    "Comprobante válido para control interno y respaldo de dispersión.",
    margin + 24,
    stampTop + 14,
    { maxWidth: contentWidth - 34 },
  );

  const gapTop = stampTop + 18;
  if (footerTop > gapTop + 2) {
    doc.setFillColor(...C.page);
    doc.rect(0, gapTop, pageWidth, footerTop - gapTop, "F");
  }

  drawFooter(doc, pageWidth, pageHeight, margin);

  doc.save(`${run.folio}.pdf`);
}
