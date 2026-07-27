import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { type IntegrationSavePayload, updateOrInsertIntegration } from "@/lib/integrationPersistence";
import { canManageIntegrations } from "@/lib/roles";

const validActions = new Set(["activate", "auto_sync", "configure", "sync"]);
const validCategories = new Set(["Almacenamiento", "Bancos", "Contabilidad", "Facturación", "Otros", "Pagos"]);

type IntegrationPatchBody = {
  action?: unknown;
  autoSync?: unknown;
  databaseId?: unknown;
  integration?: {
    autoSync?: unknown;
    category?: unknown;
    databaseId?: unknown;
    id?: unknown;
    lastSync?: unknown;
    name?: unknown;
    partner?: unknown;
    status?: unknown;
  };
};

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanCategory(value: unknown) {
  const category = cleanText(value, 40);
  return validCategories.has(category) ? category : "Otros";
}

function cleanAction(value: unknown) {
  const action = cleanText(value, 30);
  return validActions.has(action) ? action : "";
}

function payloadFromBody(body: IntegrationPatchBody, routeId: string): IntegrationSavePayload | null {
  const integration = body.integration;
  if (!integration) return null;

  const action = cleanAction(body.action);
  const name = cleanText(integration.name);
  const partner = cleanText(integration.partner || integration.id || routeId, 80);
  const currentLastSync = cleanText(integration.lastSync, 40);
  if (!action || !name || !partner) return null;

  const now = new Date().toISOString();
  const shouldRefreshSyncDate =
    action === "sync" ||
    action === "configure" ||
    (action === "activate" && !currentLastSync);
  const nextAutoSync = action === "auto_sync"
    ? Boolean(body.autoSync)
    : action === "configure"
      ? true
      : Boolean(integration.autoSync);

  return {
    auto_sync: nextAutoSync,
    estado: action === "auto_sync" ? cleanText(integration.status, 30) || "active" : "active",
    nombre: name,
    partner,
    tipo: cleanCategory(integration.category),
    ultima_sincronizacion: shouldRefreshSyncDate ? now : currentLastSync || null,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  if (!canManageIntegrations(user)) {
    return NextResponse.json({ message: "Solo administradores pueden gestionar integraciones." }, { status: 403 });
  }

  const { id } = await params;

  let body: IntegrationPatchBody;
  try {
    body = (await request.json()) as IntegrationPatchBody;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  const payload = payloadFromBody(body, id);
  if (!payload) {
    return NextResponse.json({ message: "Acción de integración no válida." }, { status: 400 });
  }

  const databaseId = cleanText(body.databaseId || body.integration?.databaseId, 80);
  const result = await updateOrInsertIntegration(
    { databaseId, partner: payload.partner },
    payload,
  );

  if (result.error || !result.data) {
    console.error("Error al actualizar integración:", result.error?.message);
    return NextResponse.json({ message: "No fue posible actualizar la integración." }, { status: 500 });
  }

  return NextResponse.json({
    integration: result.data,
    limitedPersistence: result.limitedPersistence,
    message: "Integración actualizada correctamente.",
  });
}
