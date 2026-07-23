"use client";

import { jsPDF } from "jspdf";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { notifyPdfDownload } from "@/lib/clientNotifications";
import fiscalixLogo from "../../../logo-fiscalix.png";

export type ExpenseExportRow = {
  categoria: string;
  concepto: string;
  empresa: string;
  fecha_gasto: string;
  id: string;
  monto: number;
};

export type ExpenseCategoryOption = {
  id: string;
  nombre: string;
};

export type ExpenseCompanyOption = {
  id: string;
  nombre: string;
};

type ExpenseApiResponse = {
  message?: string;
  success?: boolean;
};

type ExportDateRange = {
  from: string;
  to: string;
};

const OTHER_COMPANY_VALUE = "__other__";

const money = new Intl.NumberFormat("es-MX", { currency: "MXN", style: "currency" });
const dateLabel = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const C = {
  deep: [19, 45, 70] as [number, number, number],
  green: [1, 195, 141] as [number, number, number],
  greenDark: [0, 169, 121] as [number, number, number],
  muted: [97, 109, 124] as [number, number, number],
  navy: [25, 30, 41] as [number, number, number],
  page: [244, 247, 250] as [number, number, number],
  panel: [19, 36, 51] as [number, number, number],
  text: [238, 245, 251] as [number, number, number],
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

function formatDateRange({ from, to }: ExportDateRange) {
  if (from && to) return `${formatDate(from)} a ${formatDate(to)}`;
  if (from) return `Desde ${formatDate(from)}`;
  if (to) return `Hasta ${formatDate(to)}`;
  return "Todos los registros disponibles";
}

function isInDateRange(value: string, { from, to }: ExportDateRange) {
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
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
  const footerTop = pageHeight - 20;
  doc.setFillColor(...C.navy);
  doc.rect(0, footerTop, pageWidth, 20, "F");
  doc.setFillColor(...C.green);
  doc.rect(0, footerTop, pageWidth, 1.2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(159, 176, 192);
  doc.text("Documento generado por Fiscalix · Control interno de egresos", pageWidth / 2, footerTop + 9, { align: "center" });
}

async function downloadExpensesPdf(rows: ExpenseExportRow[], range: ExportDateRange) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = new Date();
  const total = rows.reduce((sum, row) => sum + row.monto, 0);

  function drawPageBase() {
    doc.setFillColor(...C.page);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, pageWidth, 42, "F");
    doc.setFillColor(...C.deep);
    doc.rect(0, 39, pageWidth, 3, "F");
    drawFooter(doc, pageWidth, pageHeight);
  }

  function drawTableHeader(y: number) {
    doc.setFillColor(...C.deep);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(...C.text);
    doc.text("FECHA", margin + 4, y + 6.5);
    doc.text("EMPRESA", margin + 35, y + 6.5);
    doc.text("DESCRIPCIÓN", margin + 75, y + 6.5);
    doc.text("CATEGORÍA", margin + 133, y + 6.5);
    doc.text("MONTO", pageWidth - margin - 4, y + 6.5, { align: "right" });
  }

  drawPageBase();

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
  doc.text("REPORTE DE GASTOS", pageWidth - margin, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(159, 176, 192);
  doc.text(`Generado · ${dateLabel.format(generatedAt)}`, pageWidth - margin, 23, { align: "right" });
  doc.text(`Periodo · ${formatDateRange(range)}`, pageWidth - margin, 30, { align: "right" });

  doc.setFillColor(...C.panel);
  doc.roundedRect(margin, 52, contentWidth, 26, 3, 3, "F");
  doc.setFillColor(...C.green);
  doc.roundedRect(margin, 52, contentWidth, 2, 1, 1, "F");
  const totalSummaryX = margin + contentWidth * 0.32;
  const countSummaryX = margin + contentWidth * 0.68;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(159, 176, 192);
  doc.text("TOTAL DE GASTOS", totalSummaryX, 63, { align: "center" });
  doc.text("REGISTROS EXPORTADOS", countSummaryX, 63, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.text);
  doc.text(money.format(total), totalSummaryX, 71, { align: "center" });
  doc.text(String(rows.length), countSummaryX, 71, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.navy);
  doc.text("Detalle de egresos", margin, 93);
  doc.setDrawColor(...C.greenDark);
  doc.setLineWidth(0.6);
  doc.line(margin, 95, margin + 40, 95);

  let y = 102;
  drawTableHeader(y);
  y += 12;

  rows.forEach((row, index) => {
    if (y > pageHeight - 34) {
      doc.addPage();
      drawPageBase();
      y = 24;
      drawTableHeader(y);
      y += 12;
    }

    const description = doc.splitTextToSize(row.concepto, 52).slice(0, 2);
    const company = doc.splitTextToSize(row.empresa, 34).slice(0, 2);
    const category = doc.splitTextToSize(row.categoria, 28).slice(0, 2);
    const rowHeight = Math.max(11, description.length * 4.5 + 4, company.length * 4.5 + 4, category.length * 4.5 + 4);

    doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    doc.roundedRect(margin, y - 4, contentWidth, rowHeight, 1.5, 1.5, "F");
    doc.setDrawColor(224, 231, 239);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowHeight - 4, pageWidth - margin, y + rowHeight - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(...C.muted);
    doc.text(formatDate(row.fecha_gasto), margin + 4, y + 2);
    doc.setTextColor(...C.navy);
    doc.text(company, margin + 35, y + 2);
    doc.text(description, margin + 75, y + 2);
    doc.text(category, margin + 133, y + 2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.greenDark);
    doc.text(money.format(row.monto), pageWidth - margin - 4, y + 2, { align: "right" });

    y += rowHeight + 1;
  });

  doc.save(`gastos-fiscalix-${localDateKey()}.pdf`);
}

export function ExpenseActions({
  categories,
  companies,
  rows,
}: {
  categories: ExpenseCategoryOption[];
  companies: ExpenseCompanyOption[];
  rows: ExpenseExportRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [saving, setSaving] = useState(false);

  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 3200);
  }

  function closeModal() {
    if (saving) return;
    formRef.current?.reset();
    setSelectedCompany("");
    setModalOpen(false);
  }

  function openExportModal() {
    setExportOpen(false);

    if (!rows.length) {
      notify("No hay gastos para exportar.");
      return;
    }

    setExportModalOpen(true);
  }

  function closeExportModal() {
    setExportModalOpen(false);
  }

  async function submitExportRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const range = {
      from: String(formData.get("from") ?? "").trim(),
      to: String(formData.get("to") ?? "").trim(),
    };

    if (range.from && range.to && range.from > range.to) {
      notify("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    const filteredRows = rows.filter((row) => isInDateRange(row.fecha_gasto, range));
    if (!filteredRows.length) {
      notify("No hay gastos en el rango seleccionado.");
      return;
    }

    setExportModalOpen(false);
    await downloadExpensesPdf(filteredRows, range);
    await notifyPdfDownload("expenses", { recordCount: filteredRows.length });
    notify(`PDF generado con ${filteredRows.length} ${filteredRows.length === 1 ? "gasto" : "gastos"}.`);
  }

  async function submitExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setSaving(true);
    setMessage("");

    try {
      const concepto = String(formData.get("concepto") ?? "").trim();

      const response = await fetch("/api/expenses", {
        body: JSON.stringify({
          categoriaId: formData.get("categoriaId"),
          concepto,
          empresaId: formData.get("empresaId"),
          empresaNombreOtro: formData.get("empresaNombreOtro"),
          fechaGasto: formData.get("fechaGasto"),
          monto: formData.get("monto"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as ExpenseApiResponse;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "No fue posible guardar el gasto.");
      }

      formRef.current?.reset();
      setSelectedCompany("");
      setModalOpen(false);
      notify(payload.message || "Gasto registrado correctamente.");
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible guardar el gasto.");
    } finally {
      setSaving(false);
    }
  }

  const modal = modalOpen ? (
    <div className="expenses-modal-backdrop" onMouseDown={closeModal}>
      <section
        aria-modal="true"
        className="expenses-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div>
            <p>REGISTRO DE EGRESO</p>
            <h2>Nuevo gasto</h2>
            <span>Registra un gasto para una empresa registrada o personalizada.</span>
          </div>
          <button aria-label="Cerrar modal" disabled={saving} onClick={closeModal} type="button">
            <Icon name="close" />
          </button>
        </header>

        <form className="expenses-form" onSubmit={submitExpense} ref={formRef}>
            <label>
              Empresa
              <select
                name="empresaId"
                onChange={(event) => setSelectedCompany(event.target.value)}
                required
                value={selectedCompany}
              >
                <option disabled value="">Selecciona una empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.nombre}</option>
                ))}
                <option value={OTHER_COMPANY_VALUE}>Otro</option>
              </select>
            </label>

            {selectedCompany === OTHER_COMPANY_VALUE && (
              <label>
                Nombre de la empresa
                <input maxLength={120} name="empresaNombreOtro" placeholder="Ej. Restaurante La Central" required type="text" />
              </label>
            )}

            <label>
              Descripción
              <input maxLength={180} name="concepto" placeholder="Ej. Papelería, internet, renta de oficina..." required type="text" />
            </label>

            <div className="expenses-form-grid">
              <label>
                Monto
                <input min="0.01" name="monto" placeholder="0.00" required step="0.01" type="number" />
              </label>
              <label>
                Fecha
                <input defaultValue={localDateKey()} name="fechaGasto" required type="date" />
              </label>
            </div>

            <label>
              Categoría
              <select defaultValue="" name="categoriaId">
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.nombre}</option>
                ))}
              </select>
            </label>

            <footer>
              <button disabled={saving} onClick={closeModal} type="button">Cancelar</button>
              <button className="primary-button compact" disabled={saving} type="submit">
                {saving ? "Guardando..." : "Guardar gasto"}
              </button>
            </footer>
          </form>
      </section>
    </div>
  ) : null;
  const exportModal = exportModalOpen ? (
    <div className="expenses-modal-backdrop" onMouseDown={closeExportModal}>
      <section
        aria-modal="true"
        className="expenses-modal export-range-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div>
            <p>EXPORTACIÓN PDF</p>
            <h2>Rango de gastos</h2>
            <span>Selecciona las fechas que quieres incluir en el reporte.</span>
          </div>
          <button aria-label="Cerrar modal" onClick={closeExportModal} type="button">
            <Icon name="close" />
          </button>
        </header>

        <form className="expenses-form" onSubmit={submitExportRange}>
          <div className="expenses-form-grid">
            <label>
              Desde
              <input name="from" type="date" />
            </label>
            <label>
              Hasta
              <input name="to" type="date" />
            </label>
          </div>
          <p className="expenses-field-hint">
            Si dejas una fecha vacía, Fiscalix incluirá todos los registros disponibles hacia ese lado del rango.
          </p>
          <footer>
            <button onClick={closeExportModal} type="button">Cancelar</button>
            <button className="primary-button compact" type="submit">
              Generar PDF
            </button>
          </footer>
        </form>
      </section>
    </div>
  ) : null;
  const portalTarget = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <div className="expenses-actions">
        <div className="expenses-export-wrapper">
          <button
            aria-expanded={exportOpen}
            className="expenses-export-button"
            onClick={() => setExportOpen((current) => !current)}
            type="button"
          >
            Exportar <Icon name="keyboard_arrow_down" />
          </button>
          {exportOpen && (
            <div className="expenses-export-menu">
              <button onClick={openExportModal} type="button">
                <Icon name="picture_as_pdf" /> Descargar PDF
              </button>
            </div>
          )}
        </div>

        <button className="primary-button compact" onClick={() => setModalOpen(true)} type="button">
          Nuevo gasto <Icon name="add" />
        </button>
      </div>

      {portalTarget && message ? createPortal(<div className="expenses-action-toast" role="status">{message}</div>, portalTarget) : null}
      {portalTarget && modal ? createPortal(modal, portalTarget) : null}
      {portalTarget && exportModal ? createPortal(exportModal, portalTarget) : null}
    </>
  );
}
