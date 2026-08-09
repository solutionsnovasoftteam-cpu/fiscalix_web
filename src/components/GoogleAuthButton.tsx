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
      <span aria-hidden="true" className="google-auth-icon">G</span>
      {loading ? "Conectando con Google..." : buttonText}
    </button>
  );
}
