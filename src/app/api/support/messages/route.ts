import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isGmailConfigurationError, listSupportMessages } from "@/lib/gmailSupport";
import { createTranslator } from "@/lib/i18n";
import { canViewAdminDashboard } from "@/lib/roles";
import { sendPendingSupportAutoReplies } from "@/lib/supportAutoReply";
import { withSupportReviewStatus } from "@/lib/supportReviews";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  if (!canViewAdminDashboard(user)) {
    return NextResponse.json({ message: "Solo administradores pueden consultar aclaraciones." }, { status: 403 });
  }

  const url = new URL(request.url);
  const pageToken = url.searchParams.get("pageToken") ?? undefined;
  const query = url.searchParams.get("q") ?? undefined;

  try {
    const inbox = await listSupportMessages({ pageToken, query });
    await sendPendingSupportAutoReplies({
      body: createTranslator(user.preferences?.language ?? "es")("support.defaultReply"),
      messages: inbox.messages,
    }).catch((error) => {
      console.error("Error al procesar acuses automáticos:", error instanceof Error ? error.message : error);
    });
    const messages = await withSupportReviewStatus(inbox.messages);
    return NextResponse.json({ configured: true, inbox: { ...inbox, messages } });
  } catch (error) {
    if (isGmailConfigurationError(error)) {
      return NextResponse.json({
        configured: false,
        message: error.message,
        missing: error.missing,
        supportEmail: error.supportEmail,
      }, { status: 503 });
    }

    console.error("Error al consultar Gmail:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible consultar la bandeja de aclaraciones." }, { status: 500 });
  }
}
