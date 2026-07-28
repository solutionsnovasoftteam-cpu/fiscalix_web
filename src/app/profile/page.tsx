import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmailVerificationCard } from "@/components/EmailVerificationCard";
import { Icon } from "@/components/Icon";
import { PhoneVerificationButton } from "@/components/PhoneVerificationButton";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfilePreferences } from "@/components/ProfilePreferences";
import { getAccessibleCompanyIds } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { defaultUserPreferences, userPreferenceOptions } from "@/lib/userPreferences.shared";
import { firstName, initials } from "@/lib/utils";

const activity = [
  ["check_circle", "activity.loginSuccess", "activity.loginDetail", "Hoy, 09:45 AM"],
  ["manage_accounts", "activity.profileUpdated", "activity.profileDetail", "Hoy, 08:30 AM"],
  ["home", "activity.registeredIncome", "activity.dashboardAccess", "Ayer, 04:15 PM"],
] as const;

function fallback(value?: string | null, fallbackText = "Pendiente de registrar") {
  return value?.trim() || fallbackText;
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const preferences = user.preferences ?? defaultUserPreferences;
  const t = createTranslator(preferences.language);
  const fullName = `${user.nombre} ${user.apellido}`.trim();
  const emailVerified = user.emailVerified === true;
  const phoneVerified = user.phoneVerified === true;
  const securityScore = emailVerified && phoneVerified ? "100%" : emailVerified || phoneVerified ? "75%" : "50%";
  const phone = fallback(user.telefono, t("profile.pendingRegister"));
  const state = fallback(user.estado, t("profile.accountActive"));
  const currencyLabel = userPreferenceOptions.currencies.find((option) => option.value === preferences.currency)?.label ?? preferences.currency;

  const { companyIds } = await getAccessibleCompanyIds(user);

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
    : t("profile.pendingRegister");
  const summary = [
    [t("profile.companies"), String(companyIds.length), companyIds.length === 1 ? t("profile.companyLinked") : t("profile.companiesLinked"), "business", "/companies"],
    [t("profile.movements"), String(movementCount), movementCount ? t("profile.incomeAndExpenses") : t("profile.noRecentActivity"), "sync_alt", "/dashboard"],
    [t("profile.obligations"), String(obligationCount), obligationCount ? t("profile.activeObligations") : t("profile.allGood"), "check_circle", "/companies"],
    [t("profile.reports"), String(reportPeriods.size), reportPeriods.size ? t("profile.availablePeriods") : t("profile.noActivityToAnalyze"), "bar_chart", "/reports"],
  ] as const;

  const personalInfo = [
    ["person", t("profile.fullName"), fullName],
    ["mail", t("profile.email"), user.correo],
    ["call", t("profile.phone"), phone],
    ["verified_user", t("profile.accountStatus"), state],
    ["receipt_long", "RFC", fiscalResult.data?.rfc || t("profile.pendingRegister")],
    ["balance", t("profile.fiscalRegime"), fiscalRegimeLabel],
    ["payments", t("profile.currency"), currencyLabel],
  ] as const;

  const profileActivity = [
    ...activity,
    emailVerified
      ? (["verified_user", "activity.emailVerified", "activity.verifiedDetail", "activity.current"] as const)
      : (["mail", "activity.pendingVerification", "activity.pendingVerificationDetail", "activity.pending"] as const),
  ] as const;

  return (
    <AppShell activeHref="/profile" user={user}>
      <main className="profile-content">
        <section className="profile-hero">
          <div className="profile-identity">
            <div className="profile-avatar-xl">
              <span>{initials(user.nombre, user.apellido)}</span>
              <button aria-label={t("profile.editPhoto")} type="button"><Icon name="edit" /></button>
            </div>
            <div className="profile-copy">
              <span>{t("profile.welcome")}</span>
              <h1>{firstName(user.nombre)} {user.apellido}</h1>
              <p>{t("profile.description")}</p>
              <ul>
                <li><Icon name="mail" />{user.correo}</li>
                <li><Icon name="call" />{phone}</li>
                <li><Icon name="location_on" />{t("profile.country")}</li>
              </ul>
              <form className="profile-hero-logout" action="/api/auth/logout" method="post">
                <button type="submit"><Icon name="logout" />{t("button.logout")}</button>
              </form>
            </div>
          </div>
          <EmailVerificationCard emailVerified={emailVerified} language={preferences.language} />
        </section>

        <section className="profile-grid">
          <article className="profile-card personal-card">
            <div className="profile-card-heading">
              <h2><Icon name="person" />{t("profile.personalInfo")}</h2>
              <ProfileEditor apellido={user.apellido} correo={user.correo} language={preferences.language} nombre={user.nombre} telefono={user.telefono ?? ""} />
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
              <h2><Icon name="verified_user" />{t("profile.securityStatus")}</h2>
            </div>
            <div className="security-layout">
              <div className={`security-ring${emailVerified && phoneVerified ? "" : " pending"}`}>
                <strong>{securityScore}</strong>
                <span>{t("profile.security")}</span>
                <small>{emailVerified && phoneVerified ? t("profile.high") : t("profile.medium")}</small>
              </div>
              <ul className="security-list">
                <li className={emailVerified ? "" : "is-pending"}>
                  <span><Icon name={emailVerified ? "check" : "mail"} /></span>
                  {emailVerified ? t("profile.emailConfirmed") : t("profile.emailPending")}
                </li>
                <li className={phoneVerified ? "" : "is-pending"}>
                  <span><Icon name={phoneVerified ? "check" : "call"} /></span>
                  {phoneVerified ? t("profile.phoneVerified") : t("profile.phonePending")}
                </li>
                <li><span><Icon name="check" /></span>{t("profile.securePassword")}</li>
                <li><span><Icon name="check" /></span>{t("profile.protectedSession")}</li>
              </ul>
            </div>
            <PhoneVerificationButton email={user.correo} initialPhone={user.telefono} language={preferences.language} phoneVerified={phoneVerified} />
          </article>

          <article className="profile-card activity-card">
            <div className="profile-card-heading">
              <h2><Icon name="timeline" />{t("profile.recentActivity")}</h2>
            </div>
            <div className="activity-list">
              {profileActivity.map(([icon, title, detail, time]) => (
                <div className="activity-row" key={title}>
                  <span aria-hidden="true"><Icon name={icon} /></span>
                  <div>
                    <strong>{t(title)}</strong>
                    <small>{t(detail)}</small>
                  </div>
                  <time>{time === "activity.current" ? t("activity.current") : time === "activity.pending" ? t("activity.pending") : time}</time>
                </div>
              ))}
            </div>
            <a className="profile-action" href="#"><Icon name="history" />{t("profile.viewFullHistory")} <b>›</b></a>
          </article>

          <article className="profile-card summary-card">
            <div className="profile-card-heading">
              <h2><Icon name="bar_chart" />{t("profile.accountSummary")}</h2>
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

          <ProfilePreferences initialPreferences={user.preferences} />
        </section>
      </main>
    </AppShell>
  );
}
