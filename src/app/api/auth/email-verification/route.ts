import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendEmailVerificationLinkBySupport } from "@/lib/emailVerification";
import { isGmailConfigurationError } from "@/lib/gmailSupport";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  if (user.emailVerified) {
    return NextResponse.json({
      success: true,
      message: "Tu correo ya está verificado.",
    });
  }

  try {
    await sendEmailVerificationLinkBySupport({
      email: user.correo,
      fullName: `${user.nombre} ${user.apellido}`.trim(),
      requestUrl: request.url,
    });

    return NextResponse.json({
      success: true,
      message: "Te enviamos un nuevo enlace de verificación.",
    });
  } catch (error) {
    console.error("No fue posible reenviar el correo de verificación:", error instanceof Error ? error.message : error);

    const message = isGmailConfigurationError(error)
      ? "No se pudo enviar el enlace porque falta configurar Gmail."
      : "No fue posible reenviar el correo de verificación.";

    return NextResponse.json({ success: false, message }, { status: 503 });
  }
}
