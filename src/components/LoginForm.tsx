"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const SUSPENDED_ACCOUNT_CODE = "ACCOUNT_SUSPENDED";
const SUSPENDED_ACCOUNT_MESSAGE = "Tu cuenta fue suspendida por razones de seguridad. Contacta a un administrador para realizar las aclaraciones correspondientes.";

export function LoginForm({
  initialError = "",
  initialErrorCode = "",
}: {
  initialError?: string;
  initialErrorCode?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialErrorCode === SUSPENDED_ACCOUNT_CODE ? "" : initialError);
  const [showSuspendedModal, setShowSuspendedModal] = useState(initialErrorCode === SUSPENDED_ACCOUNT_CODE);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setShowSuspendedModal(false);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const result = (await response.json()) as { code?: string; success: boolean; message?: string };
      if (!response.ok) {
        if (result.code === SUSPENDED_ACCOUNT_CODE) {
          setShowSuspendedModal(true);
          setLoading(false);
          return;
        }
        throw new Error(result.message || "No fue posible iniciar sesión.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ocurrió un error inesperado.");
      setLoading(false);
    }
  }

  return (
    <>
      <form className="login-form" action="/api/auth/login" method="post" onSubmit={submit}>
        <label>Correo electrónico<input name="email" type="email" placeholder="nombre@empresa.com" autoComplete="email" required /></label>
        <label>Contraseña
          <span className="password-field">
            <input name="password" type={showPassword ? "text" : "password"} placeholder="Ingresa tu contraseña" autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? "◉" : "○"}</button>
          </span>
        </label>
        <div className="form-options"><label><input type="checkbox" /> Recordarme</label><a href="#">¿Olvidaste tu contraseña?</a></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={loading}>{loading ? "Iniciando sesión..." : "Iniciar sesión"}</button>
      </form>

      {showSuspendedModal && (
        <div className="auth-modal-backdrop" role="presentation">
          <section
            aria-labelledby="suspended-account-title"
            aria-modal="true"
            className="auth-modal"
            role="dialog"
          >
            <div className="auth-modal-icon">!</div>
            <p>CUENTA SUSPENDIDA</p>
            <h2 id="suspended-account-title">No es posible iniciar sesión</h2>
            <span>{SUSPENDED_ACCOUNT_MESSAGE}</span>
            <button className="primary-button compact" type="button" onClick={() => setShowSuspendedModal(false)}>
              Entendido
            </button>
          </section>
        </div>
      )}
    </>
  );
}
