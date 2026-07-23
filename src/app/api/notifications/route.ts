import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncAutomaticNotificationsForUser } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  titulo: string | null;
  mensaje: string | null;
  tipo: string | null;
  url: string | null;
  leida: boolean | null;
  created_at: string | null;
};

function normalizeNotification(notification: NotificationRow) {
  return {
    id: notification.id,
    titulo: notification.titulo ?? "Notificación",
    mensaje: notification.mensaje ?? "",
    tipo: notification.tipo ?? "info",
    url: notification.url,
    leida: Boolean(notification.leida),
    created_at: notification.created_at,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    await syncAutomaticNotificationsForUser(user);

    const { data, error } = await supabase
      .from("notificaciones")
      .select("id,titulo,mensaje,tipo,url,leida,created_at")
      .eq("usuario_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error al consultar notificaciones:", error.message);
      return NextResponse.json({ message: "No fue posible cargar las notificaciones." }, { status: 500 });
    }

    const { count, error: countError } = await supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .eq("leida", false);

    if (countError) {
      console.error("Error al contar notificaciones:", countError.message);
      return NextResponse.json({ message: "No fue posible contar las notificaciones." }, { status: 500 });
    }

    return NextResponse.json({
      notifications: (data ?? []).map((notification) => normalizeNotification(notification as NotificationRow)),
      unreadCount: count ?? 0,
    });
  } catch (error) {
    console.error("Error inesperado en notificaciones:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible cargar las notificaciones." }, { status: 500 });
  }
}

export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("usuario_id", user.id)
      .eq("leida", false);

    if (error) {
      console.error("Error al marcar notificaciones como leídas:", error.message);
      return NextResponse.json({ message: "No fue posible actualizar las notificaciones." }, { status: 500 });
    }

    return NextResponse.json({ message: "Notificaciones marcadas como leídas." });
  } catch (error) {
    console.error("Error inesperado al actualizar notificaciones:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible actualizar las notificaciones." }, { status: 500 });
  }
}
