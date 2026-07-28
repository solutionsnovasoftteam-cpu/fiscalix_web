import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserPreferences, saveUserPreferences } from "@/lib/userPreferences";
import { normalizeUserPreferences } from "@/lib/userPreferences.shared";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "No autorizado" }, { status: 401 });

  const preferences = await getUserPreferences(user.id);
  return NextResponse.json({ success: true, preferences });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "No autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida" }, { status: 400 });
  }

  try {
    const preferences = await saveUserPreferences(user.id, normalizeUserPreferences(body));
    return NextResponse.json({ success: true, message: "Preferencias actualizadas.", preferences });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "No fue posible guardar las preferencias.",
    }, { status: 500 });
  }
}
