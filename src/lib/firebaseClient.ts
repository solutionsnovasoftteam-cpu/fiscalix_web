"use client";

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const FIREBASE_CLIENT_APP_NAME = "fiscalix-phone-auth";

type FirebaseClientConfigResponse = {
  config?: FirebaseOptions;
  message?: string;
  success?: boolean;
};

let authPromise: Promise<Auth> | null = null;

export async function getFiscalixFirebaseAuth() {
  authPromise ??= fetch("/api/auth/firebase-client-config", { cache: "no-store" })
    .then(async (response) => {
      const payload = (await response.json().catch(() => ({}))) as FirebaseClientConfigResponse;

      if (!response.ok || payload.success === false || !payload.config) {
        throw new Error(payload.message || "Firebase no está configurado correctamente.");
      }

      const app = getApps().some((candidate) => candidate.name === FIREBASE_CLIENT_APP_NAME)
        ? getApp(FIREBASE_CLIENT_APP_NAME)
        : initializeApp(payload.config, FIREBASE_CLIENT_APP_NAME);

      return getAuth(app);
    })
    .catch((error) => {
      authPromise = null;
      throw error;
    });

  return authPromise;
}
