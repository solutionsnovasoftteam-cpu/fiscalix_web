import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

type PdfNotificationBody = {
  documentType?: unknown;
  folio?: unknown;
  recordCount?: unknown;
};

const documentLabels = {
  dashboard: {
    label: "dashboard",
    title: "PDF del dashboard descargado",
    url: "/dashboard",
  },
  expenses: {
    label: "gastos",
    title: "PDF de gastos descargado",
    url: "/expenses",
  },
  income: {
    label: "ingresos",
    title: "PDF de ingresos descargado",
    url: "/income",
  },
  payroll: {
    label: "nómina",
    title: "PDF de nómina descargado",
    url: "/payroll",
  },
} as const;

type PdfDocumentType = keyof typeof documentLabels;

function isPdfDocumentType(value: unknown): value is PdfDocumentType {
  return typeof value === "string" && value in documentLabels;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function recordCountMessage(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count) || count <= 0) return "";
  return ` con ${Math.trunc(count)} ${Math.trunc(count) === 1 ? "registro" : "registros"}`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  let body: PdfNotificationBody;
  try {
    body = (await request.json()) as PdfNotificationBody;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  if (!isPdfDocumentType(body.documentType)) {
    return NextResponse.json({ message: "Tipo de PDF no válido." }, { status: 400 });
  }

  const config = documentLabels[body.documentType];
  const folio = cleanText(body.folio, 80);
  const suffix = recordCountMessage(body.recordCount);
  const folioText = folio ? ` (${folio})` : "";

  const created = await createNotification({
    message: `Se generó y descargó el PDF de ${config.label}${folioText}${suffix}.`,
    title: config.title,
    type: "success",
    url: config.url,
    userId: user.id,
  });

  if (!created) {
    return NextResponse.json({ message: "No fue posible crear la notificación." }, { status: 500 });
  }

  return NextResponse.json({ message: "Notificación registrada." });
}
