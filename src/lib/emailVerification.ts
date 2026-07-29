import "server-only";

import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdmin, normalizeEnvValue } from "@/lib/firebaseAdmin";
import { sendSupportEmail } from "@/lib/gmailSupport";

const VERIFY_EMAIL_ENDPOINT = "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode";

type FirebaseOobResponse = {
  error?: { message?: string };
};

function getBaseUrl(requestUrl?: string) {
  const configuredUrl =
    normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeEnvValue(process.env.APP_URL) ||
    normalizeEnvValue(process.env.NEXT_PUBLIC_SITE_URL);

  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  if (requestUrl) return new URL(requestUrl).origin;

  return "http://localhost:3000";
}

export function getEmailVerificationContinueUrl(requestUrl?: string) {
  return `${getBaseUrl(requestUrl)}/profile?emailVerified=1`;
}

export async function sendFirebaseVerificationEmail(idToken: string, requestUrl?: string) {
  const apiKey = normalizeEnvValue(process.env.FIREBASE_WEB_API_KEY);
  if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey)) {
    throw new Error("La API key web de Firebase no está configurada correctamente.");
  }

  const response = await fetch(`${VERIFY_EMAIL_ENDPOINT}?key=${apiKey}`, {
    body: JSON.stringify({
      continueUrl: getEmailVerificationContinueUrl(requestUrl),
      idToken,
      requestType: "VERIFY_EMAIL",
    }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => ({}))) as FirebaseOobResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || "No fue posible enviar el correo de verificación.");
  }
}

function verificationEmailBody(fullName: string, link: string) {
  const greeting = fullName ? `Hola ${fullName}:` : "Hola:";

  return [
    greeting,
    "",
    "Recibimos una solicitud para verificar tu correo electrónico en Fiscalix.",
    "Para confirmar que esta dirección te pertenece, abre el siguiente enlace:",
    "",
    link,
    "",
    "Si no solicitaste esta verificación, puedes ignorar este mensaje.",
    "",
    "Saludos,",
    "Equipo Fiscalix",
  ].join("\n");
}

export async function sendEmailVerificationLinkBySupport({
  email,
  fullName,
  requestUrl,
}: {
  email: string;
  fullName: string;
  requestUrl?: string;
}) {
  const link = await getAuth(getFirebaseAdmin()).generateEmailVerificationLink(email, {
    handleCodeInApp: false,
    url: getEmailVerificationContinueUrl(requestUrl),
  });

  return sendSupportEmail({
    body: verificationEmailBody(fullName, link),
    subject: "Verifica tu correo en Fiscalix",
    to: email,
  });
}
