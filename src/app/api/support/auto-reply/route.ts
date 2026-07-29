import { NextResponse } from "next/server";

import { isGmailConfigurationError, listSupportMessages } from "@/lib/gmailSupport";
import { createTranslator } from "@/lib/i18n";
import { sendPendingSupportAutoReplies } from "@/lib/supportAutoReply";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.SUPPORT_CRON_SECRET?.trim();
  if (!secret) return false;

  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${secret}`;
}

async function runSupportAutoReply(request: Request) {
  if (!process.env.SUPPORT_CRON_SECRET?.trim()) {
    return NextResponse.json({
      message: "SUPPORT_CRON_SECRET no está configurado en el servidor.",
    }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const inbox = await listSupportMessages({ maxResults: 25 });
    const stats = await sendPendingSupportAutoReplies({
      body: createTranslator("es")("support.defaultReply"),
      messages: inbox.messages,
    });

    return NextResponse.json({
      configured: true,
      message: "Revisión automática de aclaraciones ejecutada.",
      stats,
      supportEmail: inbox.supportEmail,
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

    console.error("Error en revisión automática de aclaraciones:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      message: "No fue posible ejecutar la revisión automática de aclaraciones.",
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runSupportAutoReply(request);
}

export async function POST(request: Request) {
  return runSupportAutoReply(request);
}
