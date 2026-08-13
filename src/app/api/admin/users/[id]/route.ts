import { getAuth } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFirebaseAdmin } from "@/lib/firebaseAdmin";
import { createAccountStatusNotifications } from "@/lib/notifications";
import { canManageAdminUsers, canSuspendUserAccounts, canTargetUserRole, USER_ROLES, type UserRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { getRoleIdByName, getUserRoleByUserId } from "@/lib/userRoles";

type UserAction = { action?: "activate" | "assign_admin" | "revoke_admin" | "suspend" };

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

async function authorizeTarget(targetId: string, action: "delete" | "role" | "suspend") {
  const actor = await getCurrentUser();
  if (!actor) return { error: NextResponse.json({ message: "No autorizado" }, { status: 401 }) };
  if (action === "delete" && !canManageAdminUsers(actor)) {
    return { error: NextResponse.json({ message: "Solo el superadministrador puede eliminar cuentas." }, { status: 403 }) };
  }
  if (action === "suspend" && !canSuspendUserAccounts(actor)) {
    return { error: NextResponse.json({ message: "No tienes permisos para administrar usuarios." }, { status: 403 }) };
  }
  if (action === "role" && !canManageAdminUsers(actor)) {
    return { error: NextResponse.json({ message: "Solo el superadministrador puede asignar administradores." }, { status: 403 }) };
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

async function replaceUserRole(userId: string, role: UserRole) {
  const roleId = await getRoleIdByName(role);
  if (!roleId) throw new Error("El rol seleccionado no está configurado.");

  const { error: clearError } = await supabase.from("usuario_rol").delete().eq("usuario_id", userId);
  if (clearError) throw new Error(clearError.message);

  const { error: assignError } = await supabase.from("usuario_rol").insert({ rol_id: roleId, usuario_id: userId });
  if (assignError) throw new Error(assignError.message);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    let body: UserAction;
    try {
      body = (await request.json()) as UserAction;
    } catch {
      return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
    }

    if (body.action === "assign_admin" || body.action === "revoke_admin") {
      const authorization = await authorizeTarget(id, "role");
      if (authorization.error) return authorization.error;

      const nextRole = body.action === "assign_admin" ? USER_ROLES.ADMIN : USER_ROLES.CLIENT;
      if (body.action === "assign_admin" && authorization.targetRole !== USER_ROLES.CLIENT) {
        return NextResponse.json({ message: "Solo puedes designar como administrador a un cliente." }, { status: 400 });
      }
      if (body.action === "revoke_admin" && authorization.targetRole !== USER_ROLES.ADMIN) {
        return NextResponse.json({ message: "Solo puedes revocar el rol de un administrador." }, { status: 400 });
      }

      await replaceUserRole(id, nextRole);
      return NextResponse.json({ message: body.action === "assign_admin" ? "Administrador designado correctamente." : "Rol de administrador revocado correctamente." });
    }

    const authorization = await authorizeTarget(id, "suspend");
    if (authorization.error) return authorization.error;
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
