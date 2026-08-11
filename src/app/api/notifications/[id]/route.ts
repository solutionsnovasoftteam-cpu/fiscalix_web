import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getApiUser(request);

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("id", id)
      .eq("usuario_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Error al marcar notificación como leída:", error.message);
      return NextResponse.json({ message: "No fue posible actualizar la notificación." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ message: "Notificación no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ message: "Notificación marcada como leída." });
  } catch (error) {
    console.error("Error inesperado al actualizar notificación:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible actualizar la notificación." }, { status: 500 });
  }
}
