import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { normalizeEnvValue } from "@/lib/firebaseAdmin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado" }, { status: 401 });
  }

  const apiKey = normalizeEnvValue(process.env.FIREBASE_WEB_API_KEY);
  const projectId = normalizeEnvValue(process.env.FIREBASE_PROJECT_ID);
  const authDomain = normalizeEnvValue(process.env.FIREBASE_AUTH_DOMAIN) ?? (projectId ? `${projectId}.firebaseapp.com` : undefined);

  if (!apiKey || !projectId || !authDomain) {
    return NextResponse.json({
      success: false,
      message: "La configuración pública de Firebase no está completa.",
    }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    config: {
      apiKey,
      authDomain,
      projectId,
    },
  });
}
