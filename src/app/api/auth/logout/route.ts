import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { normalizeEnvValue } from "@/lib/firebaseAdmin";

function getRedirectUrl(request: Request) {
  const fallbackUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? normalizeEnvValue(process.env.APP_URL) ?? request.url;
  const fallback = new URL(fallbackUrl);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? fallback.host;
  const proto = request.headers.get("x-forwarded-proto") ?? fallback.protocol.replace(":", "") ?? "https";

  return new URL("/login", `${proto}://${host}`);
}

function logout(request: Request) {
  const response = NextResponse.redirect(getRedirectUrl(request), 303);
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

export async function GET(request: Request) {
  return logout(request);
}

export async function POST(request: Request) {
  return logout(request);
}
