import { redirect } from "next/navigation";
import { ViewTransition } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <main className="login-page">
      <ViewTransition name="auth-panel" share="auth-panel-morph">
      <section className="login-panel">
        <div className="login-card">
          <Brand />
          <div className="login-heading"><span>Bienvenido de nuevo</span><h1>Inicia sesión en tu cuenta</h1><p>Administra tus obligaciones fiscales de forma simple y segura.</p></div>
          <LoginForm initialError={error ?? ""} />
          <p className="register-copy">¿Aún no tienes una cuenta? <Link href="/register">Crear cuenta</Link></p>
        </div>
        <p className="legal">Al continuar, aceptas nuestros <a href="#">Términos de servicio</a> y <a href="#">Aviso de privacidad</a>.</p>
      </section>
      </ViewTransition>
      <ViewTransition name="auth-visual" share="auth-visual-morph">
      <section className="login-visual">
        <div className="visual-grid" />
        <div className="visual-copy"><span>CONTROL FISCAL SIN COMPLICACIONES</span><h2>Todo lo que necesitas para tomar mejores decisiones.</h2><p>Centraliza tu información, mantén el control de tus obligaciones y consulta el estado de tu negocio desde un solo lugar.</p><div><b>+2,500</b><small>negocios confían en Fiscalix</small></div></div>
      </section>
      </ViewTransition>
    </main>
  );
}
