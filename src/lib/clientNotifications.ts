"use client";

type PdfDocumentType = "dashboard" | "expenses" | "income" | "payroll";

type PdfNotificationOptions = {
  folio?: string;
  recordCount?: number;
};

export const NOTIFICATIONS_UPDATED_EVENT = "fiscalix:notifications-updated";

export async function notifyPdfDownload(documentType: PdfDocumentType, options: PdfNotificationOptions = {}) {
  try {
    const response = await fetch("/api/notifications/pdf", {
      body: JSON.stringify({
        documentType,
        folio: options.folio,
        recordCount: options.recordCount,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) return false;

    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}
