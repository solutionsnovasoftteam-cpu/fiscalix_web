import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { firstName, initials } from "@/lib/utils";

const activity = [
  ["check_circle", "Inicio de sesión exitoso", "Navegador Chrome en Windows", "Hoy, 09:45 AM"],
  ["manage_accounts", "Perfil actualizado", "Información personal revisada", "Hoy, 08:30 AM"],
  ["home", "Ingreso registrado", "Acceso al panel principal", "Ayer, 04:15 PM"],
  ["verified_user", "Cuenta verificada", "Sesión protegida correctamente", "12 May, 07:50 PM"],
] as const;

const summary = [
  ["Empresas", "0", "Listas para registrar", "business"],
  ["Movimientos", "0", "Sin actividad reciente", "sync_alt"],
  ["Obligaciones", "0", "Todo en orden", "check_circle"],
  ["Reportes", "0", "Pendientes de generar", "bar_chart"],
] as const;

function fallback(value?: string | null, fallbackText = "Pendiente de registrar") {
  return value?.trim() || fallbackText;
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const fullName = `${user.nombre} ${user.apellido}`.trim();
  const phone = fallback(user.telefono);
  const state = fallback(user.estado, "Cuenta activa");

  const personalInfo = [
    ["person", "Nombre completo", fullName],
    ["mail", "Correo electrónico", user.correo],
    ["call", "Teléfono", phone],
    ["verified_user", "Estado de cuenta", state],
    ["receipt_long", "RFC", "Pendiente de registrar"],
    ["balance", "Régimen fiscal", "Pendiente de registrar"],
    ["payments", "Moneda", "MXN"],
  ] as const;

  const accountSettings = [
    ["mail", "Correo de acceso", user.correo],
    ["call", "Teléfono de contacto", phone],
    ["verified_user", "Estado de cuenta", state],
    ["security", "Seguridad", "Gestionar contraseña desde seguridad de la cuenta"],
  ] as const;

  return (
    <AppShell activeHref="/profile" user={user}>
      <main className="profile-content">
        <section className="profile-hero">
          <div className="profile-identity">
            <div className="profile-avatar-xl">
              <span>{initials(user.nombre, user.apellido)}</span>
              <button aria-label="Editar foto" type="button"><Icon name="edit" /></button>
            </div>
            <div className="profile-copy">
              <span>Bienvenido de nuevo,</span>
              <h1>{firstName(user.nombre)} {user.apellido}</h1>
              <p>Gestiona tu información personal y la configuración de tu cuenta de manera segura.</p>
              <ul>
                <li><Icon name="mail" />{user.correo}</li>
                <li><Icon name="call" />{phone}</li>
                <li><Icon name="location_on" />México</li>
              </ul>
            </div>
          </div>
          <aside className="verified-card">
            <span className="verified-shield"><Icon name="check" /></span>
            <div>
              <h2>Cuenta verificada <span>●</span></h2>
              <p>Tu cuenta está protegida y verificada correctamente.</p>
            </div>
          </aside>
        </section>

        <section className="profile-grid">
          <article className="profile-card personal-card">
            <div className="profile-card-heading">
              <h2><Icon name="person" />Información personal</h2>
              <button type="button">Editar información</button>
            </div>
            <div className="info-list">
              {personalInfo.map(([icon, label, value]) => (
                <div className="info-row" key={label}>
                  <span aria-hidden="true"><Icon name={icon} /></span>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="profile-card security-card">
            <div className="profile-card-heading">
              <h2><Icon name="security" />Seguridad de la cuenta</h2>
            </div>
            <div className="security-layout">
              <div className="security-ring">
                <strong>100%</strong>
                <span>Seguridad</span>
                <small>Alta</small>
              </div>
              <ul className="security-list">
                <li><span><Icon name="check" /></span>Correo verificado</li>
                <li><span><Icon name="check" /></span>Teléfono verificado</li>
                <li><span><Icon name="check" /></span>Contraseña segura</li>
                <li><span><Icon name="check" /></span>Sesión protegida</li>
              </ul>
            </div>
            <button className="profile-action" type="button"><Icon name="lock" />Cambiar contraseña <b>›</b></button>
          </article>

          <article className="profile-card activity-card">
            <div className="profile-card-heading">
              <h2><Icon name="timeline" />Actividad reciente</h2>
              <a href="#">Ver todas</a>
            </div>
            <div className="activity-list">
              {activity.map(([icon, title, detail, time]) => (
                <div className="activity-row" key={title}>
                  <span aria-hidden="true"><Icon name={icon} /></span>
                  <div>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </div>
                  <time>{time}</time>
                </div>
              ))}
            </div>
            <a className="profile-action" href="#"><Icon name="history" />Ver historial completo <b>›</b></a>
          </article>

          <article className="profile-card summary-card">
            <div className="profile-card-heading">
              <h2><Icon name="bar_chart" />Resumen de tu cuenta</h2>
            </div>
            <div className="profile-summary-grid">
              {summary.map(([label, value, helper, icon]) => (
                <div className="summary-tile" key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                  <span>{helper}</span>
                  <b><Icon name={icon} /></b>
                </div>
              ))}
            </div>
          </article>

          <article className="profile-card settings-card">
            <div className="profile-card-heading">
              <h2><Icon name="settings" />Configuración de cuenta</h2>
            </div>
            <div className="settings-list">
              {accountSettings.map(([icon, label, value]) => (
                <div className="settings-row" key={label}>
                  <span aria-hidden="true"><Icon name={icon} /></span>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
