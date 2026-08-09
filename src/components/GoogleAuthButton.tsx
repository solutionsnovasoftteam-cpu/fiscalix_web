"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebaseClient";

const SUSPENDED_ACCOUNT_CODE = "ACCOUNT_SUSPENDED";
const GOOGLE_ACCOUNT_EXISTS_CODE = "GOOGLE_ACCOUNT_EXISTS";
const GOOGLE_ACCOUNT_NOT_FOUND_CODE = "GOOGLE_ACCOUNT_NOT_FOUND";

type GoogleAuthButtonProps = {
  disabled?: boolean;
  mode: "login" | "register";
  onError: (message: string) => void;
  onSuspended?: () => void;
};

function authErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

  if (code === "auth/popup-closed-by-user") return "Inicio con Google cancelado.";
  if (code === "auth/account-exists-with-different-credential") {
    return "Este correo ya existe con otro método de acceso. Inicia sesión con correo y contraseña.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Este dominio no está autorizado en Firebase para iniciar sesión con Google.";
  }

  return error instanceof Error ? error.message : "No fue posible continuar con Google.";
}

export function GoogleAuthButton({ disabled = false, mode, onError, onSuspended }: GoogleAuthButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const buttonText = mode === "login" ? "Continuar con Google" : "Registrarme con Google";

  async function continueWithGoogle() {
    setLoading(true);
    onError("");

    try {
      const auth = await getFirebaseClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/google", {
        body: JSON.stringify({ mode }),
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
        success?: boolean;
      };

      if (!response.ok || result.success === false) {
        if (result.code === SUSPENDED_ACCOUNT_CODE) {
          await signOut(auth);
          onSuspended?.();
          setLoading(false);
          return;
        }

        if (result.code === GOOGLE_ACCOUNT_EXISTS_CODE || result.code === GOOGLE_ACCOUNT_NOT_FOUND_CODE) {
          await signOut(auth);
        }

        throw new Error(result.message || "No fue posible continuar con Google.");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      onError(authErrorMessage(error));
      setLoading(false);
    }
  }

  return (
    <button
      className="google-auth-button"
      data-loading={loading ? "true" : "false"}
      disabled={disabled || loading}
      onClick={continueWithGoogle}
      type="button"
    >
      <span aria-hidden="true" className="google-auth-icon">
        <svg viewBox="0 0 24 24" role="presentation">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.83-1.77-5.62-4.14H3.04v2.62A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.38 13.85A6 6 0 0 1 6.07 12c0-.64.11-1.27.31-1.85V7.53H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.47l3.34-2.62Z" />
          <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.53l3.34 2.62C7.17 7.78 9.39 6.01 12 6.01Z" />
        </svg>
      </span>
      {loading ? "Conectando con Google..." : buttonText}
    </button>
  );
}
