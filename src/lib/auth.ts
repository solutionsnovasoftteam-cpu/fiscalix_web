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

async function getUserByFirebaseUid(
  uid: string,
  emailVerifiedFallback = false,
): Promise<FiscalixUser | null> {
  try {
    const auth = getAuth(getFirebaseAdmin());
    const { data, error } = await supabase
      .from("usuarios")
      .select("id,nombre,apellido,correo,telefono,estado")
      .eq("id", uid)
      .single();

    if (error || !data) return null;
    if (data.estado && data.estado !== "activo") return null;

    const [firebaseUser, role, preferences] = await Promise.all([
      auth
        .getUser(uid)
        .then((userRecord) => ({
          emailVerified: userRecord.emailVerified,
        }))
        .catch(() => ({
          emailVerified: emailVerifiedFallback,
        })),
      getUserRoleByUserId(uid),
      getUserPreferences(uid),
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

export async function getCurrentUser(): Promise<FiscalixUser | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await getAuth(getFirebaseAdmin()).verifySessionCookie(session, true);
    return getUserByFirebaseUid(decoded.uid, Boolean(decoded.email_verified));
  } catch {
    return null;
  }
}

/**
 * Autentica APIs compartidas por Web y Mobile. Web utiliza la cookie de sesión
 * de Fiscalix; Mobile puede enviar un Firebase ID token como Bearer token.
 */
export async function getApiUser(request: Request): Promise<FiscalixUser | null> {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return getCurrentUser();

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) return null;

  try {
    const decoded = await verifyToken(match[1]);
    return getUserByFirebaseUid(decoded.uid, Boolean(decoded.email_verified));
  } catch {
    return null;
  }
}
