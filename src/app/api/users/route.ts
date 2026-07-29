import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getCurrentUser } from "@/lib/auth";
import { getFirebaseAdmin, normalizeEnvValue } from "@/lib/firebaseAdmin";
import { supabase } from "@/lib/supabase";

type ProfilePatchBody = {
  apellido?: unknown;
  correo?: unknown;
  currentPassword?: unknown;
  nombre?: unknown;
  telefono?: unknown;
};

type FirebasePasswordCheckResponse = {
  email?: string;
  error?: { message?: string };
  idToken?: string;
  localId?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function firebaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

async function verifyCurrentPassword({
  email,
  password,
  uid,
}: {
  email: string;
  password: string;
  uid: string;
}) {
  const apiKey = normalizeEnvValue(process.env.FIREBASE_WEB_API_KEY);
  if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey)) {
    return { message: "La API key web de Firebase no está configurada correctamente.", ok: false, status: 503 };
  }

  const firebaseResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  const firebaseData = (await firebaseResponse.json().catch(() => ({}))) as FirebasePasswordCheckResponse;
  const code = firebaseData.error?.message?.split(" : ")[0] ?? "";

  if (!firebaseResponse.ok || !firebaseData.idToken || firebaseData.localId !== uid) {
    const message = {
      EMAIL_NOT_FOUND: "No fue posible validar tu cuenta actual.",
      INVALID_LOGIN_CREDENTIALS: "La contraseña actual no es correcta.",
      INVALID_PASSWORD: "La contraseña actual no es correcta.",
      TOO_MANY_ATTEMPTS_TRY_LATER: "Demasiados intentos. Intenta más tarde.",
      USER_DISABLED: "Esta cuenta está deshabilitada en Firebase.",
    }[code] ?? "No fue posible validar tu contraseña actual.";

    return { message, ok: false, status: code === "TOO_MANY_ATTEMPTS_TRY_LATER" ? 429 : 401 };
  }

  return { ok: true, status: 200 };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado", data: null }, { status: 401 });
  }
  return NextResponse.json({ success: true, message: "Usuario encontrado", data: user });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida" }, { status: 400 });
  }

  const values = body as ProfilePatchBody;
  const nombre = cleanText(values.nombre);
  const apellido = cleanText(values.apellido);
  const telefono = cleanText(values.telefono);
  const correo = cleanEmail(values.correo || user.correo);
  const currentPassword = typeof values.currentPassword === "string" ? values.currentPassword : "";
  const emailChanged = correo !== user.correo.toLowerCase();

  if (!nombre || !apellido) {
    return NextResponse.json({ success: false, message: "Nombre y apellido son obligatorios." }, { status: 400 });
  }
  if (nombre.length > 80 || apellido.length > 80 || telefono.length > 25 || correo.length > 160) {
    return NextResponse.json({ success: false, message: "Uno de los campos excede la longitud permitida." }, { status: 400 });
  }
  if (telefono && !/^[0-9+()\-\s]{7,25}$/.test(telefono)) {
    return NextResponse.json({ success: false, message: "Ingresa un teléfono válido." }, { status: 400 });
  }
  if (!emailPattern.test(correo)) {
    return NextResponse.json({ success: false, message: "Ingresa un correo electrónico válido." }, { status: 400 });
  }

  const auth = getAuth(getFirebaseAdmin());
  let firebaseEmail = user.correo.toLowerCase();

  if (emailChanged) {
    if (!currentPassword) {
      return NextResponse.json({
        success: false,
        message: "Para cambiar tu correo, ingresa tu contraseña actual.",
      }, { status: 400 });
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("correo", correo)
      .neq("id", user.id)
      .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json({ success: false, message: "No fue posible validar el correo." }, { status: 500 });
    }
    if (existingProfile) {
      return NextResponse.json({ success: false, message: "Ese correo ya está registrado en Fiscalix." }, { status: 409 });
    }

    try {
      const firebaseUser = await auth.getUser(user.id);
      firebaseEmail = firebaseUser.email?.toLowerCase() || firebaseEmail;
      const existingFirebaseUser = await auth.getUserByEmail(correo).catch((error: unknown) => {
        if (firebaseErrorCode(error) === "auth/user-not-found") return null;
        throw error;
      });

      if (existingFirebaseUser && existingFirebaseUser.uid !== user.id) {
        return NextResponse.json({ success: false, message: "Ese correo ya existe en Firebase." }, { status: 409 });
      }
    } catch (error) {
      console.error("Error al validar correo en Firebase:", error instanceof Error ? error.message : error);
      return NextResponse.json({ success: false, message: "No fue posible validar el correo en Firebase." }, { status: 500 });
    }

    const passwordCheck = await verifyCurrentPassword({
      email: firebaseEmail,
      password: currentPassword,
      uid: user.id,
    });

    if (!passwordCheck.ok) {
      return NextResponse.json({ success: false, message: passwordCheck.message }, { status: passwordCheck.status });
    }

    try {
      await auth.updateUser(user.id, { email: correo, emailVerified: false });
    } catch (error) {
      const code = firebaseErrorCode(error);
      const message = code === "auth/email-already-exists"
        ? "Ese correo ya existe en Firebase."
        : "No fue posible actualizar el correo en Firebase.";
      return NextResponse.json({ success: false, message }, { status: code === "auth/email-already-exists" ? 409 : 500 });
    }
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update({ apellido, correo, nombre, telefono: telefono || null })
    .eq("id", user.id)
    .select("id,nombre,apellido,correo,telefono,estado")
    .single();

  if (error || !data) {
    if (emailChanged) {
      try {
        await auth.updateUser(user.id, { email: firebaseEmail });
      } catch (revertError) {
        console.error("No fue posible revertir el correo en Firebase:", revertError instanceof Error ? revertError.message : revertError);
      }
    }
    return NextResponse.json({ success: false, message: "No fue posible actualizar la información." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: emailChanged
      ? "Información y correo de acceso actualizados correctamente."
      : "Información actualizada correctamente.",
    data,
  });
}
