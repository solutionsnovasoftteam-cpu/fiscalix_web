import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupportMessage, isGmailConfigurationError } from "@/lib/gmailSupport";
import { canViewAdminDashboard } from "@/lib/roles";
import { getSupportReviewStatus } from "@/lib/supportReviews";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  if (!canViewAdminDashboard(user)) {
    return NextResponse.json({ message: "Solo administradores pueden consultar aclaraciones." }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Mensaje no válido." }, { status: 400 });

  try {
    const [message, review] = await Promise.all([
      getSupportMessage(id),
      getSupportReviewStatus(id),
    ]);
    return NextResponse.json({ message: { ...message, ...review } });
  } catch (error) {
    if (isGmailConfigurationError(error)) {
      return NextResponse.json({
        configured: false,
        message: error.message,
        missing: error.missing,
        supportEmail: error.supportEmail,
      }, { status: 503 });
    }

    console.error("Error al consultar mensaje de Gmail:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible consultar el mensaje." }, { status: 500 });
  }
}
