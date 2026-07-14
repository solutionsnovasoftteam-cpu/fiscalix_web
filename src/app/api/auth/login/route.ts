import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE, verifyToken } from "@/lib/auth";
import { normalizeEnvValue } from "@/lib/firebaseAdmin";
import { supabase } from "@/lib/supabase";

interface FirebaseLoginResponse {
  idToken?: string;
  localId?: string;
  error?: { message?: string };
}

const SUSPENDED_ACCOUNT_CODE = "ACCOUNT_SUSPENDED";
const SUSPENDED_ACCOUNT_MESSAGE = "Tu cuenta fue suspendida por razones de seguridad. Contacta a un administrador para realizar las aclaraciones correspondientes.";

const firebaseMessages: Record<string, string> = {
  EMAIL_NOT_FOUND: "No existe una cuenta con este correo.",
  INVALID_PASSWORD: "La contraseña es incorrecta.",
  INVALID_LOGIN_CREDENTIALS: "El correo o la contraseña son incorrectos.",
  USER_DISABLED: "Esta cuenta se encuentra deshabilitada.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Demasiados intentos. Intenta más tarde.",
};

export async function POST(request: Request) {
  try {
    const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;
    const body = isJson
      ? ((await request.json()) as { email?: unknown; password?: unknown })
      : Object.fromEntries(await request.formData());
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const apiKey = normalizeEnvValue(process.env.FIREBASE_WEB_API_KEY);

    function failure(message: string, status: number, code?: string) {
      if (isJson) return NextResponse.json({ success: false, code, message }, { status });
      const url = new URL("/login", request.url);
      url.searchParams.set("error", message);
      if (code) url.searchParams.set("code", code);
      return NextResponse.redirect(url, 303);
    }

    async function suspendedFailureIfNeeded() {
      const { data: suspendedProfile } = await supabase
        .from("usuarios")
        .select("estado")
        .eq("correo", email)
        .maybeSingle();

      if (suspendedProfile?.estado === "suspendido") {
        return failure(SUSPENDED_ACCOUNT_MESSAGE, 403, SUSPENDED_ACCOUNT_CODE);
      }

      return null;
    }

    if (!email || !password) {
      return failure("Ingresa tu correo y contraseña.", 400);
    }
    if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey)) {
      console.error("FIREBASE_WEB_API_KEY no existe o no tiene formato de API key web");
      return failure("La API key web de Firebase no está configurada correctamente.", 503);
    }

    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        cache: "no-store",
      },
    );
    const firebaseData = (await firebaseResponse.json()) as FirebaseLoginResponse;

    if (!firebaseResponse.ok || !firebaseData.idToken || !firebaseData.localId) {
      const code = firebaseData.error?.message?.split(" : ")[0] ?? "";
      if (code === "USER_DISABLED") {
        const suspendedFailure = await suspendedFailureIfNeeded();
        if (suspendedFailure) return suspendedFailure;
      }
      return failure(firebaseMessages[code] ?? "No fue posible iniciar sesión.", 401);
    }

    const decoded = await verifyToken(firebaseData.idToken);
    const { data: profile, error } = await supabase
      .from("usuarios")
      .select("id,nombre,apellido,correo,telefono,estado")
      .eq("id", decoded.uid)
      .single();

    if (error || !profile) {
      return failure("Tu cuenta no tiene un perfil de Fiscalix asociado.", 403);
    }
    if (profile.estado === "suspendido") {
      return failure(SUSPENDED_ACCOUNT_MESSAGE, 403, SUSPENDED_ACCOUNT_CODE);
    }
    if (profile.estado && profile.estado !== "activo") {
      return failure("Tu cuenta no está activa.", 403);
    }

    const sessionCookie = await createSession(firebaseData.idToken);
    const response = isJson
      ? NextResponse.json({ success: true, user: profile })
      : NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Error al iniciar sesión:", error instanceof Error ? error.message : error);
    const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;
    if (isJson) {
      return NextResponse.json({ success: false, message: "Ocurrió un error. Intenta nuevamente." }, { status: 500 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "Ocurrió un error. Intenta nuevamente.");
    return NextResponse.redirect(url, 303);
  }
}
