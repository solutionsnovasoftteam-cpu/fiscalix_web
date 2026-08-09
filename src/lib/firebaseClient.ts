"use client";

import { FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";

let authPromise: Promise<Auth> | null = null;

async function loadFirebaseConfig() {
  const response = await fetch("/api/auth/firebase-client-config", {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as FirebaseOptions & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Firebase no está configurado para iniciar sesión con Google.");
  }

  return payload;
}

export function getFirebaseClientAuth() {
  authPromise ??= loadFirebaseConfig().then((config) => {
    const app = getApps().length ? getApp() : initializeApp(config);
    return getAuth(app);
  });

  return authPromise;
}
