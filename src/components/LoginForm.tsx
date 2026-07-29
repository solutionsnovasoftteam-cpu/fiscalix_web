"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModal } from "@/lib/useModal";

const SUSPENDED_ACCOUNT_CODE = "ACCOUNT_SUSPENDED";
const SUSPENDED_ACCOUNT_MESSAGE = "Tu cuenta fue suspendida.";
const DEFAULT_SUPPORT_EMAIL = "solutionsnovasoftteam@gmail.com";
const SUSPENDED_ACCOUNT_SUBJECT = "Aclaración";

export function LoginForm({
  initialError = "",
  initialErrorCode = "",
  supportEmail = DEFAULT_SUPPORT_EMAIL,
}: {
  initialError?: string;
  initialErrorCode?: string;
  supportEmail?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialErrorCode === SUSPENDED_ACCOUNT_CODE ? "" : initialError);
  const [showSuspendedModal, setShowSuspendedModal] = useState(initialErrorCode === SUSPENDED_ACCOUNT_CODE);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const suspendedDialogRef = useRef<HTMLElement>(null);
  const resetDialogRef = useRef<HTMLElement>(null);
  const gmailSupportUrl = `https://mail.google.com/mail/?${new URLSearchParams({
    fs: "1",
    su: SUSPENDED_ACCOUNT_SUBJECT,
    to: supportEmail,
    view: "cm",
  }).toString()}`;
  const closeSuspendedModal = useCallback(() => setShowSuspendedModal(false), []);
  const closeResetModal = useCallback(() => {
    setShowResetModal(false);
    setResetError("");
    setResetLoading(false);
    setResetMessage("");
  }, []);
  useModal({ dialogRef: suspendedDialogRef, onClose: closeSuspendedModal, open: showSuspendedModal });
  useModal({ busy: resetLoading, dialogRef: resetDialogRef, onClose: closeResetModal, open: showResetModal });

  function openResetModal() {
    setResetEmail(loginEmail);
    setResetError("");
    setResetMessage("");
    setShowResetModal(true);
  }

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

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetLoading(true);
    setResetError("");
    setResetMessage("");

    try {
      const response = await fetch("/api/auth/password-reset", {
        body: JSON.stringify({ email: resetEmail }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string; success?: boolean };

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "No fue posible enviar el correo de recuperación.");
      }

      setResetMessage(result.message || "Si el correo existe, enviaremos instrucciones para recuperar la contraseña.");
    } catch (reason) {
      setResetError(reason instanceof Error ? reason.message : "Ocurrió un error inesperado.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <>
      <form className="login-form" action="/api/auth/login" method="post" onSubmit={submit}>
        <label>Correo electrónico<input name="email" type="email" placeholder="nombre@empresa.com" autoComplete="email" onChange={(event) => setLoginEmail(event.target.value)} required value={loginEmail} /></label>
        <label>Contraseña
          <span className="password-field">
            <input name="password" type={showPassword ? "text" : "password"} placeholder="Ingresa tu contraseña" autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? "◉" : "○"}</button>
          </span>
        </label>
        <div className="form-options"><label><input type="checkbox" /> Recordarme</label><button className="auth-link-button" onClick={openResetModal} type="button">¿Olvidaste tu contraseña?</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={loading}>{loading ? "Iniciando sesión..." : "Iniciar sesión"}</button>
      </form>

      {showSuspendedModal && (
        <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSuspendedModal(); }}>
          <section
            aria-labelledby="suspended-account-title"
            aria-modal="true"
            className="auth-modal"
            ref={suspendedDialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="auth-modal-icon">!</div>
            <p>CUENTA SUSPENDIDA</p>
            <h2 id="suspended-account-title">No es posible iniciar sesión</h2>
            <span>
              {SUSPENDED_ACCOUNT_MESSAGE} Contacta a{" "}
              <a
                className="suspended-support-link"
                href={gmailSupportUrl}
                rel="noreferrer"
                target="_blank"
              >
                {supportEmail}
              </a>
              {" "}para hacer las aclaraciones correspondientes.
            </span>
            <button className="primary-button compact" type="button" onClick={() => setShowSuspendedModal(false)}>
              Entendido
            </button>
          </section>
        </div>
      )}

      {showResetModal && (
        <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !resetLoading) closeResetModal(); }}>
          <section
            aria-labelledby="password-reset-title"
            aria-modal="true"
            className="auth-modal password-reset-modal"
            ref={resetDialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="auth-modal-icon">↻</div>
            <p>RECUPERAR ACCESO</p>
            <h2 id="password-reset-title">Restablece tu contraseña</h2>
            <span>Escribe el correo de tu cuenta y enviaremos instrucciones para crear una nueva contraseña.</span>
            <form className="auth-modal-form" onSubmit={submitPasswordReset}>
              <label>
                Correo electrónico
                <input
                  autoComplete="email"
                  disabled={resetLoading}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                  type="email"
                  value={resetEmail}
                />
              </label>
              {resetError && <p className="form-error" role="alert">{resetError}</p>}
              {resetMessage && <p className="form-success" role="status">{resetMessage}</p>}
              <div className="auth-modal-actions">
                <button disabled={resetLoading} onClick={closeResetModal} type="button">Cancelar</button>
                <button className="primary-button compact" disabled={resetLoading} type="submit">
                  {resetLoading ? "Enviando..." : "Enviar correo"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
