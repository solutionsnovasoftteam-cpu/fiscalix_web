import { NextResponse } from "next/server";
import { normalizeEnvValue } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = normalizeEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) ?? normalizeEnvValue(process.env.FIREBASE_WEB_API_KEY);
  const projectId = normalizeEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ?? normalizeEnvValue(process.env.FIREBASE_PROJECT_ID);
  const authDomain = normalizeEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) ?? (projectId ? `${projectId}.firebaseapp.com` : undefined);
  const appId = normalizeEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
  const messagingSenderId = normalizeEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
  const storageBucket = normalizeEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

  if (!apiKey || !projectId || !authDomain) {
    return NextResponse.json(
      {
        message: "Faltan variables públicas de Firebase para habilitar el inicio con Google.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    apiKey,
    appId,
    authDomain,
    messagingSenderId,
    projectId,
    storageBucket,
  });
}
