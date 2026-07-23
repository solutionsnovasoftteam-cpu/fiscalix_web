import { getAuth } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFirebaseAdmin } from "@/lib/firebaseAdmin";
import { createAccountStatusNotifications } from "@/lib/notifications";
import { canManageAdminUsers, canSuspendUserAccounts, canTargetUserRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { getUserRoleByUserId } from "@/lib/userRoles";

type UserAction = {
  action?: "activate" | "suspend";
};

async function getTargetUser(targetId: string) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,apellido,correo,estado")
    .eq("id", targetId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function setFirebaseDisabled(uid: string, disabled: boolean) {
  try {
    await getAuth(getFirebaseAdmin()).updateUser(uid, { disabled });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "auth/user-not-found") throw error;
  }
}

async function deleteFirebaseUser(uid: string) {
  try {
    await getAuth(getFirebaseAdmin()).deleteUser(uid);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "auth/user-not-found") throw error;
  }
}

async function authorizeTarget(targetId: string, action: "delete" | "suspend") {
  const actor = await getCurrentUser();
  if (!actor) return { error: NextResponse.json({ message: "No autorizado" }, { status: 401 }) };
  if (action === "delete" && !canManageAdminUsers(actor)) {
    return { error: NextResponse.json({ message: "Solo el superadministrador puede eliminar cuentas." }, { status: 403 }) };
  }
  if (action === "suspend" && !canSuspendUserAccounts(actor)) {
    return { error: NextResponse.json({ message: "No tienes permisos para administrar usuarios." }, { status: 403 }) };
  }
  if (actor.id === targetId) {
    return { error: NextResponse.json({ message: "No puedes modificar tu propia cuenta desde este panel." }, { status: 400 }) };
  }

  const target = await getTargetUser(targetId);
  if (!target) return { error: NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 }) };

  const targetRole = await getUserRoleByUserId(targetId);
  if (!canTargetUserRole(actor.rol, targetRole)) {
    return { error: NextResponse.json({ message: "No puedes administrar usuarios con ese rol." }, { status: 403 }) };
  }

  return { actor, target, targetRole };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const authorization = await authorizeTarget(id, "suspend");
    if (authorization.error) return authorization.error;

    const body = (await request.json()) as UserAction;
    const nextStatus = body.action === "activate" ? "activo" : body.action === "suspend" ? "suspendido" : null;

    if (!nextStatus) {
      return NextResponse.json({ message: "Acción no válida." }, { status: 400 });
    }

    await setFirebaseDisabled(id, nextStatus === "suspendido");

    const { error } = await supabase
      .from("usuarios")
      .update({ estado: nextStatus })
      .eq("id", id);

    if (error) {
      console.error("Error al actualizar estado de usuario:", error.message);
      return NextResponse.json({ message: "No fue posible actualizar el estado del usuario." }, { status: 500 });
    }

    await createAccountStatusNotifications({
      actor: authorization.actor,
      nextStatus,
      targetName: [authorization.target.nombre, authorization.target.apellido].filter(Boolean).join(" ") || authorization.target.correo,
      targetUserId: id,
    });

    return NextResponse.json({
      message: nextStatus === "suspendido" ? "Cuenta suspendida correctamente." : "Cuenta reactivada correctamente.",
    });
  } catch (error) {
    console.error("Error al administrar usuario:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible completar la acción." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const authorization = await authorizeTarget(id, "delete");
    if (authorization.error) return authorization.error;

    const relationTables = ["usuario_rol", "empresa_usuario", "notificacion_usuario", "reportes"];
    for (const table of relationTables) {
      const { error } = await supabase.from(table).delete().eq("usuario_id", id);
      if (error) {
        console.error(`Error al limpiar ${table}:`, error.message);
        return NextResponse.json({ message: "No fue posible limpiar las relaciones del usuario." }, { status: 500 });
      }
    }

    const { error } = await supabase.from("usuarios").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar usuario:", error.message);
      return NextResponse.json({ message: "No fue posible eliminar el perfil del usuario." }, { status: 500 });
    }

    await deleteFirebaseUser(id);

    return NextResponse.json({ message: "Cuenta eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar usuario:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible eliminar la cuenta." }, { status: 500 });
  }
}
