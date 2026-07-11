import { getAuth } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE, verifyToken } from "@/lib/auth";
import { getFirebaseAdmin, normalizeEnvValue } from "@/lib/firebaseAdmin";
import { supabase } from "@/lib/supabase";

interface SignUpResponse {
  idToken?: string;
  localId?: string;
  email?: string;
  error?: { message?: string };
}

const firebaseMessages: Record<string, string> = {
  EMAIL_EXISTS: "Ya existe una cuenta con este correo.",
  INVALID_EMAIL: "El correo electrónico no es válido.",
  WEAK_PASSWORD: "La contraseña debe tener al menos 6 caracteres.",
  OPERATION_NOT_ALLOWED: "El registro con correo y contraseña no está habilitado en Firebase.",
};

export async function POST(request: Request) {
  let createdUid: string | null = null;
  const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;

  function failure(message: string, status: number) {
    if (isJson) return NextResponse.json({ success: false, message }, { status });
    const url = new URL("/register", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  }

  try {
    const body = isJson
      ? ((await request.json()) as Record<string, unknown>)
      : Object.fromEntries(await request.formData());
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    const apellido = typeof body.apellido === "string" ? body.apellido.trim() : "";
    const correo = typeof body.correo === "string" ? body.correo.trim().toLowerCase() : "";
    const telefono = typeof body.telefono === "string" ? body.telefono.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!nombre || !apellido || !correo || !telefono) {
      return failure("Completa todos los campos obligatorios.", 400);
    }
    if (password && password.length < 6) {
      return failure("La contraseña debe tener al menos 6 caracteres.", 400);
    }

    let idToken: string | null = null;
    let uid: string;
    let verifiedEmail: string | undefined;

    if (password) {
      const apiKey = normalizeEnvValue(process.env.FIREBASE_WEB_API_KEY);
      if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey)) {
        return failure("La API key web de Firebase no está configurada correctamente.", 503);
      }

      const firebaseResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: correo, password, returnSecureToken: true }),
          cache: "no-store",
        },
      );
      const firebaseData = (await firebaseResponse.json()) as SignUpResponse;
      if (!firebaseResponse.ok || !firebaseData.idToken || !firebaseData.localId) {
        const code = firebaseData.error?.message?.split(" : ")[0] ?? "";
        return failure(firebaseMessages[code] ?? "No fue posible crear la cuenta en Firebase.", 409);
      }

      idToken = firebaseData.idToken;
      createdUid = firebaseData.localId;
      const decoded = await verifyToken(idToken);
      uid = decoded.uid;
      verifiedEmail = decoded.email;
    } else {
      const authorization = request.headers.get("authorization");
      const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
      if (!token) {
        return failure("No autorizado", 401);
      }
      const decoded = await verifyToken(token);
      uid = decoded.uid;
      verifiedEmail = decoded.email;
    }

    if (verifiedEmail?.toLowerCase() !== correo) {
      if (createdUid) await getAuth(getFirebaseAdmin()).deleteUser(createdUid);
      return failure("El correo no coincide con la cuenta de Firebase.", 400);
    }

    const { data, error } = await supabase.from("usuarios").insert({
      id: uid,
      nombre,
      apellido,
      correo,
      telefono,
      estado: "activo",
    }).select("id,nombre,apellido,correo,telefono,estado").single();

    if (error) {
      if (createdUid) await getAuth(getFirebaseAdmin()).deleteUser(createdUid);
      console.error("Error de Supabase al registrar usuario:", error.code);
      return failure("No fue posible guardar el perfil del usuario.", 409);
    }

    const response = isJson
      ? NextResponse.json({ success: true, message: "Cuenta creada correctamente", data }, { status: 201 })
      : NextResponse.redirect(new URL("/dashboard", request.url), 303);
    if (idToken) {
      const sessionCookie = await createSession(idToken);
      response.cookies.set(SESSION_COOKIE, sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
        path: "/",
      });
    }
    return response;
  } catch (error) {
    if (createdUid) {
      try {
        await getAuth(getFirebaseAdmin()).deleteUser(createdUid);
      } catch {
        console.error("No fue posible revertir la cuenta de Firebase incompleta.");
      }
    }
    console.error("Error al registrar usuario:", error instanceof Error ? error.message : error);
    return failure("Ocurrió un error al crear la cuenta.", 500);
  }
}
