import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";

export function normalizeEnvValue(value: string | undefined) {
  if (!value) return undefined;

  let normalized = value.trim();
  if (normalized.endsWith(",")) normalized = normalized.slice(0, -1).trim();
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function normalizePrivateKey(value: string | undefined) {
  return normalizeEnvValue(value)?.replace(/\\n/g, "\n");
}

export function getFirebaseAdmin() {
  return getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: normalizeEnvValue(process.env.FIREBASE_PROJECT_ID),
      clientEmail: normalizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL),
      privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}
