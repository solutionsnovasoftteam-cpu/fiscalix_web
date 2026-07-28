import { getAuth } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFirebaseAdmin } from "@/lib/firebaseAdmin";
import { supabase } from "@/lib/supabase";

type PhoneVerificationBody = {
  phone?: unknown;
};

function normalizeMexicanPhone(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+52${digits}`;
  if (digits.startsWith("52") && digits.length === 12) return `+${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : "";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado" }, { status: 401 });
  }

  let body: PhoneVerificationBody;
  try {
    body = (await request.json()) as PhoneVerificationBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida" }, { status: 400 });
  }

  const phone = normalizeMexicanPhone(body.phone);
  if (!phone) {
    return NextResponse.json({ success: false, message: "Ingresa un teléfono válido en formato internacional." }, { status: 400 });
  }

  try {
    const firebaseUser = await getAuth(getFirebaseAdmin()).getUser(user.id);
    if (firebaseUser.phoneNumber !== phone) {
      return NextResponse.json({
        success: false,
        message: "El teléfono aún no aparece verificado en Firebase.",
      }, { status: 409 });
    }

    const { error } = await supabase
      .from("usuarios")
      .update({ telefono: phone })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ success: false, message: "El teléfono se verificó, pero no fue posible sincronizar el perfil." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Teléfono verificado correctamente.",
      phone,
      phoneVerified: true,
    });
  } catch (error) {
    console.error("Error al sincronizar verificación telefónica:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, message: "No fue posible confirmar la verificación telefónica." }, { status: 500 });
  }
}
