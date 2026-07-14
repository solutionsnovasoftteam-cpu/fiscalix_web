import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { ProfileEditor } from "@/components/ProfileEditor";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { firstName, initials } from "@/lib/utils";

const activity = [
  ["check_circle", "Inicio de sesión exitoso", "Navegador Chrome en Windows", "Hoy, 09:45 AM"],
  ["manage_accounts", "Perfil actualizado", "Información personal revisada", "Hoy, 08:30 AM"],
  ["home", "Ingreso registrado", "Acceso al panel principal", "Ayer, 04:15 PM"],
  ["verified_user", "Cuenta verificada", "Sesión protegida correctamente", "12 May, 07:50 PM"],
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

  let companyIds: string[] = [];
  if (canViewAdminDashboard(user)) {
    const { data } = await supabase.from("empresas").select("id").neq("estado", "suspendida");
    companyIds = (data ?? []).map((item) => item.id);
  } else {
    const { data } = await supabase.from("empresa_usuario").select("empresa_id").eq("usuario_id", user.id);
    companyIds = [...new Set((data ?? []).map((item) => item.empresa_id).filter(Boolean))] as string[];
  }

  const [incomeResult, expenseResult, obligationResult, fiscalResult] = companyIds.length
    ? await Promise.all([
        supabase.from("ingresos").select("fecha_ingreso").in("empresa_id", companyIds),
        supabase.from("gastos").select("fecha_gasto").in("empresa_id", companyIds),
        supabase.from("obligaciones_fiscales").select("id").in("empresa_id", companyIds).eq("activa", true),
        supabase.from("empresa_fiscal").select("rfc,regimenes_fiscales(clave_sat,nombre)").eq("empresa_id", companyIds[0]).maybeSingle(),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: null, error: null }];

  const reportPeriods = new Set([
    ...(incomeResult.data ?? []).map((item) => item.fecha_ingreso?.slice(0, 7)),
    ...(expenseResult.data ?? []).map((item) => item.fecha_gasto?.slice(0, 7)),
  ].filter(Boolean));
  const movementCount = (incomeResult.data?.length ?? 0) + (expenseResult.data?.length ?? 0);
  const obligationCount = obligationResult.data?.length ?? 0;
  const fiscalRegime = Array.isArray(fiscalResult.data?.regimenes_fiscales)
    ? fiscalResult.data.regimenes_fiscales[0]
    : fiscalResult.data?.regimenes_fiscales;
  const fiscalRegimeLabel = fiscalRegime
    ? [fiscalRegime.clave_sat, fiscalRegime.nombre].filter(Boolean).join(" · ")
    : "Pendiente de registrar";
  const summary = [
    ["Empresas", String(companyIds.length), companyIds.length === 1 ? "Empresa vinculada" : "Empresas vinculadas", "business", "/companies"],
    ["Movimientos", String(movementCount), movementCount ? "Ingresos y gastos registrados" : "Sin actividad reciente", "sync_alt", "/dashboard"],
    ["Obligaciones", String(obligationCount), obligationCount ? "Obligaciones activas" : "Todo en orden", "check_circle", "/companies"],
    ["Reportes", String(reportPeriods.size), reportPeriods.size ? "Periodos disponibles" : "Sin actividad para analizar", "bar_chart", "/reports"],
  ] as const;

  const personalInfo = [
    ["person", "Nombre completo", fullName],
    ["mail", "Correo electrónico", user.correo],
    ["call", "Teléfono", phone],
    ["verified_user", "Estado de cuenta", state],
    ["receipt_long", "RFC", fiscalResult.data?.rfc || "Pendiente de registrar"],
    ["balance", "Régimen fiscal", fiscalRegimeLabel],
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
              <ProfileEditor apellido={user.apellido} correo={user.correo} nombre={user.nombre} telefono={user.telefono ?? ""} />
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
              {summary.map(([label, value, helper, icon, href]) => (
                <Link className="summary-tile" href={href} key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                  <span>{helper}</span>
                  <b><Icon name={icon} /></b>
                </Link>
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
