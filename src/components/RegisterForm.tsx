"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.get("nombre"),
          apellido: form.get("apellido"),
          telefono: form.get("telefono"),
          correo: form.get("correo"),
          password,
        }),
      });
      const result = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok) throw new Error(result.message || "No fue posible crear la cuenta.");
      router.replace("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ocurrió un error inesperado.");
      setLoading(false);
    }
  }

  return (
    <form className="login-form register-form" action="/api/auth/register" method="post" onSubmit={submit}>
      <div className="field-row">
        <label>Nombre<input name="nombre" type="text" placeholder="Tu nombre" autoComplete="given-name" required /></label>
        <label>Apellido<input name="apellido" type="text" placeholder="Tu apellido" autoComplete="family-name" required /></label>
      </div>
      <label>Correo electrónico<input name="correo" type="email" placeholder="nombre@empresa.com" autoComplete="email" required /></label>
      <label>Teléfono<input name="telefono" type="tel" placeholder="10 dígitos" autoComplete="tel" minLength={10} maxLength={15} required /></label>
      <div className="field-row">
        <label>Contraseña
          <span className="password-field">
            <input name="password" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" autoComplete="new-password" minLength={6} required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Mostrar u ocultar contraseña">{showPassword ? "◉" : "○"}</button>
          </span>
        </label>
        <label>Confirmar contraseña<input name="confirmation" type={showPassword ? "text" : "password"} placeholder="Repite tu contraseña" autoComplete="new-password" minLength={6} required /></label>
      </div>
      <label className="terms-check"><input type="checkbox" required /> <span>Acepto los <a href="#">Términos de servicio</a> y el <a href="#">Aviso de privacidad</a>.</span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={loading}>{loading ? "Creando cuenta..." : "Crear cuenta"}</button>
      <p className="register-copy">¿Ya tienes una cuenta? <Link href="/login">Iniciar sesión</Link></p>
    </form>
  );
}
