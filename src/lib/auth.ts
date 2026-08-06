import "server-only";

import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { getFirebaseAdmin } from "@/lib/firebaseAdmin";
import { supabase } from "@/lib/supabase";
import { getUserPreferences } from "@/lib/userPreferences";
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
    const auth = getAuth(getFirebaseAdmin());
    const decoded = await auth.verifySessionCookie(session, true);
    const { data, error } = await supabase
      .from("usuarios")
      .select("id,nombre,apellido,correo,telefono,estado,avatar_url")
      .eq("id", decoded.uid)
      .single();

    if (error || !data) return null;
    if (data.estado && data.estado !== "activo") return null;

    const [firebaseUser, role, preferences] = await Promise.all([
      auth
        .getUser(decoded.uid)
        .then((userRecord) => ({
          emailVerified: userRecord.emailVerified,
        }))
        .catch(() => ({
          emailVerified: Boolean(decoded.email_verified),
        })),
      getUserRoleByUserId(decoded.uid),
      getUserPreferences(decoded.uid),
    ]);

    return {
      ...(data as Omit<FiscalixUser, "rol">),
      emailVerified: firebaseUser.emailVerified,
      telefono: data.telefono ?? null,
      preferences,
      rol: role,
    };
  } catch {
    return null;
  }
}
