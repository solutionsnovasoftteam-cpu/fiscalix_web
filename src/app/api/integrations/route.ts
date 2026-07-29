import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { insertIntegration, type IntegrationSavePayload } from "@/lib/integrationPersistence";
import { canManageIntegrations } from "@/lib/roles";

const validCategories = new Set(["Almacenamiento", "Bancos", "Contabilidad", "Facturación", "Otros", "Pagos"]);

type IntegrationRequestBody = {
  integration?: {
    category?: unknown;
    id?: unknown;
    name?: unknown;
    partner?: unknown;
  };
};

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanCategory(value: unknown) {
  const category = cleanText(value, 40);
  return validCategories.has(category) ? category : "Otros";
}

function payloadFromBody(body: IntegrationRequestBody): IntegrationSavePayload | null {
  const integration = body.integration;
  if (!integration) return null;

  const name = cleanText(integration.name);
  const partner = cleanText(integration.partner || integration.id, 80);
  if (!name || !partner) return null;

  return {
    auto_sync: false,
    estado: "pending",
    nombre: name,
    partner,
    tipo: cleanCategory(integration.category),
    ultima_sincronizacion: null,
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  if (!canManageIntegrations(user)) {
    return NextResponse.json({ message: "Solo administradores pueden gestionar integraciones." }, { status: 403 });
  }

  let body: IntegrationRequestBody;
  try {
    body = (await request.json()) as IntegrationRequestBody;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  const payload = payloadFromBody(body);
  if (!payload) {
    return NextResponse.json({ message: "Selecciona una integración válida." }, { status: 400 });
  }

  const result = await insertIntegration(payload);
  if (result.error || !result.data) {
    console.error("Error al guardar integración:", result.error?.message);
    return NextResponse.json({ message: "No fue posible guardar la integración." }, { status: 500 });
  }

  return NextResponse.json({
    integration: result.data,
    limitedPersistence: result.limitedPersistence,
    message: "Integración agregada correctamente.",
  });
}
