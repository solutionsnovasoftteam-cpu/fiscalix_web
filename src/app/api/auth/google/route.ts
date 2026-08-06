import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE, verifyToken } from "@/lib/auth";
import { assignFreePlanToNewUser } from "@/lib/defaultSubscription";
import { supabase } from "@/lib/supabase";
import { ensureDefaultUserPreferences } from "@/lib/userPreferences";
import { assignDefaultRoleToUser } from "@/lib/userRoles";

const SUSPENDED_ACCOUNT_CODE = "ACCOUNT_SUSPENDED";
const SUSPENDED_ACCOUNT_MESSAGE = "Tu cuenta fue suspendida. Contacta a solutionsnovasoftteam@gmail.com para hacer las aclaraciones correspondientes.";
const GOOGLE_ACCOUNT_EXISTS_CODE = "GOOGLE_ACCOUNT_EXISTS";
const GOOGLE_ACCOUNT_NOT_FOUND_CODE = "GOOGLE_ACCOUNT_NOT_FOUND";

type GoogleAuthMode = "login" | "register";

function splitDisplayName(displayName: string | undefined, email: string) {
  const parts = (displayName ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const fallbackName = email.split("@")[0] || "Usuario";

  if (!parts.length) {
    return { apellido: "Google", nombre: fallbackName };
  }

  const nombre = parts.shift() ?? fallbackName;
  const apellido = parts.join(" ") || "Google";
  return { apellido, nombre };
}

function failure(message: string, status: number, code?: string) {
  return NextResponse.json({ success: false, code, message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
    const mode: GoogleAuthMode | null = body.mode === "login" || body.mode === "register" ? body.mode : null;
    const authorization = request.headers.get("authorization");
    const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";

    if (!idToken) {
      return failure("No autorizado.", 401);
    }
    if (!mode) {
      return failure("Indica si deseas iniciar sesión o crear una cuenta.", 400);
    }

    const decoded = await verifyToken(idToken);
    const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
    const signInProvider = String(decoded.firebase?.sign_in_provider ?? "");

    if (!email) {
      return failure("La cuenta de Google no devolvió un correo válido.", 400);
    }
    if (signInProvider !== "google.com") {
      return failure("Este acceso solo acepta cuentas autenticadas con Google.", 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("usuarios")
      .select("id,nombre,apellido,correo,telefono,estado")
      .eq("id", decoded.uid)
      .maybeSingle();

    if (profileError) {
      console.error("Error al consultar perfil Google:", profileError.message);
      return failure("No fue posible consultar el perfil del usuario.", 500);
    }

    if (profile) {
      if (profile.estado === "suspendido") {
        return failure(SUSPENDED_ACCOUNT_MESSAGE, 403, SUSPENDED_ACCOUNT_CODE);
      }
      if (profile.estado && profile.estado !== "activo") {
        return failure("Tu cuenta no está activa.", 403);
      }
      if (mode === "register") {
        return failure(
          "Ya existe una cuenta de Fiscalix vinculada a este usuario de Google. Inicia sesión.",
          409,
          GOOGLE_ACCOUNT_EXISTS_CODE,
        );
      }

      const sessionCookie = await createSession(idToken);
      const response = NextResponse.json({ success: true, user: profile });
      response.cookies.set(SESSION_COOKIE, sessionCookie, {
        httpOnly: true,
        maxAge: SESSION_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return response;
    }

    if (mode === "login") {
      return failure(
        "Esta cuenta de Google todavía no está registrada en Fiscalix. Crea una cuenta primero.",
        404,
        GOOGLE_ACCOUNT_NOT_FOUND_CODE,
      );
    }

    const { data: existingEmailProfile, error: emailProfileError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("correo", email)
      .maybeSingle();

    if (emailProfileError) {
      console.error("Error al validar correo Google:", emailProfileError.message);
      return failure("No fue posible validar el correo del usuario.", 500);
    }

    if (existingEmailProfile?.id && existingEmailProfile.id !== decoded.uid) {
      return failure("Este correo ya está asociado a otra cuenta de Fiscalix.", 409);
    }

    const decodedName = typeof decoded.name === "string" ? decoded.name : undefined;
    const { apellido, nombre } = splitDisplayName(decodedName, email);
    const phoneNumber = typeof decoded.phone_number === "string" ? decoded.phone_number : "";

    const { data: newProfile, error: insertError } = await supabase
      .from("usuarios")
      .insert({
        apellido,
        avatar_url: typeof decoded.picture === "string" ? decoded.picture : null,
        correo: email,
        estado: "activo",
        id: decoded.uid,
        nombre,
        telefono: phoneNumber,
      })
      .select("id,nombre,apellido,correo,telefono,estado")
      .single();

    if (insertError || !newProfile) {
      console.error("Error al crear perfil Google:", insertError?.message ?? "sin perfil");
      return failure("No fue posible crear el perfil del usuario.", 409);
    }

    await assignDefaultRoleToUser(decoded.uid);
    await ensureDefaultUserPreferences(decoded.uid);
    const defaultPlan = await assignFreePlanToNewUser(newProfile);

    const sessionCookie = await createSession(idToken);
    const response = NextResponse.json({
      created: true,
      defaultPlan,
      success: true,
      user: newProfile,
    }, { status: 201 });

    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Error al iniciar con Google:", error instanceof Error ? error.message : error);
    return failure("No fue posible iniciar sesión con Google.", 500);
  }
}
