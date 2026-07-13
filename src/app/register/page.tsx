import { redirect } from "next/navigation";
import { ViewTransition } from "react";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { RegisterForm } from "@/components/RegisterForm";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="login-page register-page">
      <ViewTransition name="auth-panel" share="auth-panel-morph">
      <section className="login-panel">
        <div className="login-card register-card">
          <Brand />
          <div className="login-heading">
            <span>COMIENZA HOY</span>
            <h1>Crea tu cuenta en Fiscalix</h1>
            <p>Organiza tu información fiscal y mantén el control de tu negocio.</p>
          </div>
          <RegisterForm initialError={error ?? ""} />
        </div>
      </section>
      </ViewTransition>
      <ViewTransition name="auth-visual" share="auth-visual-morph">
      <section className="login-visual register-visual">
        <div className="visual-grid" />
        <div className="visual-copy">
          <span>UNA CUENTA, TODO TU NEGOCIO</span>
          <h2>Empieza a tomar el control de tus finanzas.</h2>
          <p>Crea tu perfil en minutos y consulta movimientos, obligaciones y reportes desde un mismo lugar.</p>
          <ul className="benefit-list">
            <li><b><Icon name="check" /></b><span><strong>Información centralizada</strong><small>Todo lo importante siempre disponible.</small></span></li>
            <li><b><Icon name="check" /></b><span><strong>Acceso seguro</strong><small>Tu sesión está protegida por Firebase.</small></span></li>
            <li><b><Icon name="check" /></b><span><strong>Control sencillo</strong><small>Diseñado para entenderse desde el primer día.</small></span></li>
          </ul>
        </div>
      </section>
      </ViewTransition>
    </main>
  );
}
