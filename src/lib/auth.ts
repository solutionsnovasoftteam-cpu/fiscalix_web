import "server-only";

import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { getFirebaseAdmin } from "@/lib/firebaseAdmin";
import { supabase } from "@/lib/supabase";
import { getUserRoleByUserId } from "@/lib/userRoles";
import type { FiscalixUser } from "@/models/User";

export const SESSION_COOKIE = "fiscalix_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 5;

export async function verifyToken(token: string) {
  return getAuth(getFirebaseAdmin()).verifyIdToken(token);
}

export async function createSession(idToken: string) {
  return getAuth(getFirebaseAdmin()).createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE * 1000,
  });
}

export async function getCurrentUser(): Promise<FiscalixUser | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await getAuth(getFirebaseAdmin()).verifySessionCookie(session, true);
    const { data, error } = await supabase
      .from("usuarios")
      .select("id,nombre,apellido,correo,telefono,estado")
      .eq("id", decoded.uid)
      .single();

    if (error || !data) return null;
    if (data.estado && data.estado !== "activo") return null;

    return {
      ...(data as Omit<FiscalixUser, "rol">),
      rol: await getUserRoleByUserId(decoded.uid),
    };
  } catch {
    return null;
  }
}
