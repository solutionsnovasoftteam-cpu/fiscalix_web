import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import {
  isSupportReviewTableMissingError,
  setSupportMessageReviewed,
} from "@/lib/supportReviews";

type ReviewBody = {
  reviewed?: unknown;
  threadId?: unknown;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  if (!canViewAdminDashboard(user)) {
    return NextResponse.json({ message: "Solo administradores pueden revisar aclaraciones." }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Mensaje no válido." }, { status: 400 });

  let payload: ReviewBody;
  try {
    payload = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  try {
    const review = await setSupportMessageReviewed({
      messageId: id,
      reviewed: payload.reviewed === true,
      reviewedBy: user.id,
      threadId: cleanText(payload.threadId),
    });

    return NextResponse.json({ review, success: true });
  } catch (error) {
    if (isSupportReviewTableMissingError(error)) {
      return NextResponse.json({
        message: "Falta crear la tabla de revisiones. Ejecuta scripts/support-message-reviews-schema.sql en Supabase.",
      }, { status: 503 });
    }

    console.error("Error al actualizar revisión de aclaración:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible actualizar el estado de revisión." }, { status: 500 });
  }
}
