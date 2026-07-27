import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  isGmailApiError,
  isGmailConfigurationError,
  sendSupportReply,
  type GmailApiError,
} from "@/lib/gmailSupport";
import { canViewAdminDashboard } from "@/lib/roles";

type ReplyBody = {
  body?: unknown;
};

function cleanReplyBody(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function needsSendScope(error: GmailApiError) {
  const message = error.message.toLowerCase();
  return error.status === 403 && (
    message.includes("insufficient") ||
    message.includes("scope") ||
    message.includes("permission")
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  if (!canViewAdminDashboard(user)) {
    return NextResponse.json({ message: "Solo administradores pueden responder aclaraciones." }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Mensaje no válido." }, { status: 400 });

  let payload: ReplyBody;
  try {
    payload = (await request.json()) as ReplyBody;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  const body = cleanReplyBody(payload.body);
  if (body.length < 3) {
    return NextResponse.json({ message: "Escribe una respuesta antes de enviar." }, { status: 400 });
  }
  if (body.length > 8000) {
    return NextResponse.json({ message: "La respuesta es demasiado larga. Máximo 8,000 caracteres." }, { status: 400 });
  }

  try {
    const sent = await sendSupportReply(id, body);
    return NextResponse.json({
      message: "Respuesta enviada correctamente.",
      sent,
      success: true,
    });
  } catch (error) {
    if (isGmailConfigurationError(error)) {
      return NextResponse.json({
        configured: false,
        message: error.message,
        missing: error.missing,
        supportEmail: error.supportEmail,
      }, { status: 503 });
    }

    if (isGmailApiError(error) && needsSendScope(error)) {
      return NextResponse.json({
        message: "El token de Gmail no tiene permiso para enviar correos. Regenera el refresh token incluyendo gmail.readonly y gmail.send.",
      }, { status: 403 });
    }

    console.error("Error al responder aclaración:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible enviar la respuesta." }, { status: 500 });
  }
}
