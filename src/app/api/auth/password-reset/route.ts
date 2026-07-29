import { NextResponse } from "next/server";
import { normalizeEnvValue } from "@/lib/firebaseAdmin";

type PasswordResetBody = {
  email?: unknown;
};

type FirebasePasswordResetResponse = {
  email?: string;
  error?: { message?: string };
};

const GENERIC_RESET_MESSAGE = "Si el correo existe en Fiscalix, enviaremos instrucciones para recuperar la contraseña.";

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: PasswordResetBody;

  try {
    body = (await request.json()) as PasswordResetBody;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida.", success: false }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  const apiKey = normalizeEnvValue(process.env.FIREBASE_WEB_API_KEY);

  if (!email || !isEmail(email)) {
    return NextResponse.json({ message: "Ingresa un correo electrónico válido.", success: false }, { status: 400 });
  }

  if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey)) {
    console.error("FIREBASE_WEB_API_KEY no existe o no tiene formato de API key web");
    return NextResponse.json(
      { message: "La recuperación de contraseña no está configurada correctamente.", success: false },
      { status: 503 },
    );
  }

  try {
    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        body: JSON.stringify({
          email,
          requestType: "PASSWORD_RESET",
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    const firebaseData = (await firebaseResponse.json().catch(() => ({}))) as FirebasePasswordResetResponse;
    const firebaseCode = firebaseData.error?.message?.split(" : ")[0] ?? "";

    if (!firebaseResponse.ok && firebaseCode !== "EMAIL_NOT_FOUND") {
      console.error("Error de Firebase al solicitar recuperación:", firebaseCode || firebaseData.error?.message);
      return NextResponse.json(
        { message: "No fue posible enviar el correo de recuperación. Intenta de nuevo más tarde.", success: false },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: GENERIC_RESET_MESSAGE, success: true });
  } catch (error) {
    console.error("Error al solicitar recuperación de contraseña:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { message: "No fue posible enviar el correo de recuperación. Intenta de nuevo más tarde.", success: false },
      { status: 500 },
    );
  }
}
