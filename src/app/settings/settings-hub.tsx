"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";

type Theme = "dark" | "light";
export type ActivityRow = {
  action: string;
  date: string;
  description: string;
  id: string;
  module: string;
  user: string;
};

export type SettingsCompany = {
  address: string;
  commercialName: string;
  email: string;
  legalName: string;
  phone: string;
  regime: string;
  rfc: string;
};

export type SettingsInitialData = {
  activity: ActivityRow[];
  company: SettingsCompany;
  userName: string;
};

const defaultCompany: SettingsCompany = {
  address: "Pendiente de registrar",
  commercialName: "Pendiente de registrar",
  email: "Pendiente de registrar",
  legalName: "Pendiente de registrar",
  phone: "Pendiente de registrar",
  regime: "Pendiente de registrar",
  rfc: "Pendiente de registrar",
};

const quickLinks = [
  { id: "company", icon: "settings", title: "Información de la empresa", text: "Datos fiscales y contacto", target: "settings-company" },
  { id: "users", icon: "manage_accounts", title: "Usuarios y permisos", text: "Roles y accesos del equipo", target: "settings-company" },
  { id: "security", icon: "security", title: "Seguridad", text: "Contraseña, 2FA y sesiones", target: "settings-security" },
  { id: "notifications", icon: "notifications", title: "Notificaciones", text: "Alertas y recordatorios", target: "settings-preferences" },
  { id: "backups", icon: "sync_alt", title: "Respaldos", text: "Copias y retención", target: "settings-backup" },
] as const;

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function SettingsHub({ initialData }: { initialData?: SettingsInitialData }) {
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editingCompany, setEditingCompany] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [twoFactor, setTwoFactor] = useState(true);
  const [theme, setTheme] = useState<Theme>("dark");
  const [lastBackup, setLastBackup] = useState("Pendiente de realizar");
  const [activity, setActivity] = useState<ActivityRow[]>(initialData?.activity ?? []);

  const [company, setCompany] = useState(initialData?.company ?? defaultCompany);

  const [companyDraft, setCompanyDraft] = useState(company);

  const [preferences, setPreferences] = useState({
    currency: "MXN - Peso Mexicano",
    timezone: "America/Mexico_City",
    language: "Español",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24 horas",
    autoLogout: "30 minutos",
    backupFrequency: "Diario",
    backupRetention: "30 días",
    backupDestination: "Nube (AWS S3)",
  });

  const visibleActivity = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = showAllActivity ? activity : activity.slice(0, 4);
    if (!term) return rows;
    return rows.filter((row) =>
      [row.date, row.user, row.action, row.module, row.description].join(" ").toLowerCase().includes(term),
    );
  }, [activity, query, showAllActivity]);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveChanges() {
    if (editingCompany) setCompany(companyDraft);
    setEditingCompany(false);
    const entry: ActivityRow = {
      id: `a-${Date.now()}`,
      date: dateFmt.format(new Date()),
      user: initialData?.userName ?? "Tú",
      action: "Guardado",
      module: "Configuraciones",
      description: "Se guardaron los cambios del sistema.",
    };
    setActivity((rows) => [entry, ...rows]);
    notify("Cambios guardados correctamente.");
  }

  function toggleEditCompany() {
    if (editingCompany) {
      setCompanyDraft(company);
      setEditingCompany(false);
      notify("Edición cancelada.");
      return;
    }
    setCompanyDraft(company);
    setEditingCompany(true);
  }

  function runBackup() {
    const stamp = dateFmt.format(new Date());
    setLastBackup(stamp);
    setActivity((rows) => [
      {
        id: `backup-${Date.now()}`,
        date: stamp,
        user: "Sistema",
        action: "Respaldo",
        module: "Respaldos",
        description: "Respaldo manual completado en AWS S3.",
      },
      ...rows,
    ]);
    notify("Respaldo realizado correctamente.");
  }

  function handleSecurityAction(label: string) {
    notify(`${label}: disponible próximamente en esta versión demo.`);
  }

  return (
    <div className="settings-page">
      {feedback && (
        <div className="settings-feedback" role="status">
          <Icon name="check_circle" />
          {feedback}
        </div>
      )}

      <header className="settings-header">
        <div>
          <p className="settings-eyebrow">PREFERENCIAS DEL SISTEMA</p>
          <h1>Configuraciones</h1>
          <span>Personaliza y administra las preferencias del sistema</span>
        </div>
        <div className="settings-header-actions">
          <label className="settings-search">
            <Icon name="search" />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar configuración..."
              type="search"
              value={query}
            />
          </label>
          <button className="settings-btn settings-btn-primary" onClick={saveChanges} type="button">
            Guardar cambios
          </button>
        </div>
      </header>

      <section className="settings-quick" aria-label="Accesos rápidos">
        {quickLinks.map((link) => (
          <button
            className="settings-quick-card"
            key={link.id}
            onClick={() => scrollToSection(link.target)}
            type="button"
          >
            <span><Icon name={link.icon} /></span>
            <strong>{link.title}</strong>
            <small>{link.text}</small>
            <em>Gestionar <Icon name="keyboard_arrow_down" /></em>
          </button>
        ))}
      </section>

      <div className="settings-grid">
        <section className="settings-panel" id="settings-company">
          <div className="settings-panel-head">
            <h2>Información de la empresa</h2>
            <span><Icon name="business" /></span>
          </div>
          <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Nombre comercial
              <input
                disabled={!editingCompany}
                onChange={(event) => setCompanyDraft((value) => ({ ...value, commercialName: event.target.value }))}
                value={editingCompany ? companyDraft.commercialName : company.commercialName}
              />
            </label>
            <label>
              Razón social
              <input
                disabled={!editingCompany}
                onChange={(event) => setCompanyDraft((value) => ({ ...value, legalName: event.target.value }))}
                value={editingCompany ? companyDraft.legalName : company.legalName}
              />
            </label>
            <div className="settings-form-row">
              <label>
                RFC
                <input
                  disabled={!editingCompany}
                  onChange={(event) => setCompanyDraft((value) => ({ ...value, rfc: event.target.value }))}
                  value={editingCompany ? companyDraft.rfc : company.rfc}
                />
              </label>
              <label>
                Régimen fiscal
                <select
                  disabled={!editingCompany}
                  onChange={(event) => setCompanyDraft((value) => ({ ...value, regime: event.target.value }))}
                  value={editingCompany ? companyDraft.regime : company.regime}
                >
                  <option>601 - General de Ley Personas Morales</option>
                  <option>612 - Personas Físicas con Actividades Empresariales</option>
                  <option>626 - Régimen Simplificado de Confianza</option>
                </select>
              </label>
            </div>
            <label>
              Dirección fiscal
              <input
                disabled={!editingCompany}
                onChange={(event) => setCompanyDraft((value) => ({ ...value, address: event.target.value }))}
                value={editingCompany ? companyDraft.address : company.address}
              />
            </label>
            <div className="settings-form-row">
              <label>
                Teléfono
                <input
                  disabled={!editingCompany}
                  onChange={(event) => setCompanyDraft((value) => ({ ...value, phone: event.target.value }))}
                  value={editingCompany ? companyDraft.phone : company.phone}
                />
              </label>
              <label>
                Correo electrónico
                <input
                  disabled={!editingCompany}
                  onChange={(event) => setCompanyDraft((value) => ({ ...value, email: event.target.value }))}
                  type="email"
                  value={editingCompany ? companyDraft.email : company.email}
                />
              </label>
            </div>
            <button className="settings-btn settings-btn-outline" onClick={toggleEditCompany} type="button">
              <Icon name="edit" />
              {editingCompany ? "Cancelar edición" : "Editar información"}
            </button>
          </form>
        </section>

        <section className="settings-panel" id="settings-preferences">
          <div className="settings-panel-head">
            <h2>Preferencias del sistema</h2>
          </div>
          <div className="settings-prefs">
            <label>
              <span><Icon name="attach_money" /> Moneda principal</span>
              <select onChange={(event) => setPreferences((value) => ({ ...value, currency: event.target.value }))} value={preferences.currency}>
                <option>MXN - Peso Mexicano</option>
                <option>USD - Dólar estadounidense</option>
                <option>EUR - Euro</option>
              </select>
            </label>
            <label>
              <span><Icon name="timeline" /> Zona horaria</span>
              <select onChange={(event) => setPreferences((value) => ({ ...value, timezone: event.target.value }))} value={preferences.timezone}>
                <option>America/Mexico_City</option>
                <option>America/Tijuana</option>
                <option>America/Cancun</option>
              </select>
            </label>
            <label>
              <span><Icon name="person" /> Idioma</span>
              <select onChange={(event) => setPreferences((value) => ({ ...value, language: event.target.value }))} value={preferences.language}>
                <option>Español</option>
                <option>English</option>
              </select>
            </label>
            <label>
              <span><Icon name="event_note" /> Formato de fecha</span>
              <select onChange={(event) => setPreferences((value) => ({ ...value, dateFormat: event.target.value }))} value={preferences.dateFormat}>
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </label>
            <label>
              <span><Icon name="timeline" /> Formato de hora</span>
              <select onChange={(event) => setPreferences((value) => ({ ...value, timeFormat: event.target.value }))} value={preferences.timeFormat}>
                <option>24 horas</option>
                <option>12 horas</option>
              </select>
            </label>
            <div className="settings-theme">
              <span>Tema del sistema</span>
              <div className="settings-theme-options">
                <button
                  className={theme === "dark" ? "is-active" : undefined}
                  onClick={() => setTheme("dark")}
                  type="button"
                >
                  Oscuro
                </button>
                <button
                  className={theme === "light" ? "is-active" : undefined}
                  onClick={() => setTheme("light")}
                  type="button"
                >
                  Claro
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="settings-side">
          <section className="settings-panel" id="settings-security">
            <div className="settings-panel-head">
              <h2>Seguridad de la cuenta</h2>
            </div>
            <div className="settings-security-list">
              <div className="settings-security-row">
                <div>
                  <strong>Autenticación de dos factores (2FA)</strong>
                  <small>Protege tu cuenta con un código adicional</small>
                </div>
                <button
                  aria-label={twoFactor ? "Desactivar 2FA" : "Activar 2FA"}
                  className={`settings-toggle${twoFactor ? " is-on" : ""}`}
                  onClick={() => setTwoFactor((value) => !value)}
                  type="button"
                >
                  <i />
                </button>
              </div>
              <button className="settings-list-link" onClick={() => handleSecurityAction("Cambio de contraseña")} type="button">
                <span>Cambio de contraseña</span>
                <Icon name="keyboard_arrow_down" />
              </button>
              <button className="settings-list-link" onClick={() => handleSecurityAction("Sesiones activas")} type="button">
                <span>Sesiones activas</span>
                <Icon name="keyboard_arrow_down" />
              </button>
              <label className="settings-list-select">
                <span>Cierre de sesión automático</span>
                <select
                  onChange={(event) => setPreferences((value) => ({ ...value, autoLogout: event.target.value }))}
                  value={preferences.autoLogout}
                >
                  <option>15 minutos</option>
                  <option>30 minutos</option>
                  <option>1 hora</option>
                  <option>Nunca</option>
                </select>
              </label>
            </div>
          </section>

          <section className="settings-panel" id="settings-backup">
            <div className="settings-panel-head">
              <h2>Respaldo del sistema</h2>
            </div>
            <div className="settings-backup">
              <p>Último respaldo: <strong>{lastBackup}</strong></p>
              <button className="settings-btn settings-btn-primary settings-btn-block" onClick={runBackup} type="button">
                Realizar respaldo ahora
              </button>
              <label>
                Frecuencia
                <select
                  onChange={(event) => setPreferences((value) => ({ ...value, backupFrequency: event.target.value }))}
                  value={preferences.backupFrequency}
                >
                  <option>Diario</option>
                  <option>Semanal</option>
                  <option>Mensual</option>
                </select>
              </label>
              <label>
                Retención
                <select
                  onChange={(event) => setPreferences((value) => ({ ...value, backupRetention: event.target.value }))}
                  value={preferences.backupRetention}
                >
                  <option>7 días</option>
                  <option>30 días</option>
                  <option>90 días</option>
                </select>
              </label>
              <div className="settings-destination">
                <span>Destino</span>
                <strong><i /> {preferences.backupDestination}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="settings-panel settings-activity">
        <div className="settings-panel-head">
          <div>
            <h2>Actividad reciente en configuraciones</h2>
            <p>Historial de cambios realizados en el sistema</p>
          </div>
          <button className="settings-link-btn" onClick={() => setShowAllActivity((value) => !value)} type="button">
            {showAllActivity ? "Ver menos" : "Ver todo el historial"}
          </button>
        </div>
        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Descripción</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibleActivity.length === 0 ? (
                <tr>
                  <td className="settings-empty" colSpan={6}>No hay registros que coincidan con tu búsqueda.</td>
                </tr>
              ) : (
                visibleActivity.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.user}</td>
                    <td>{row.action}</td>
                    <td>{row.module}</td>
                    <td>{row.description}</td>
                    <td className="settings-row-menu">
                      <button
                        aria-label={`Opciones de ${row.action}`}
                        className="settings-icon-btn"
                        onClick={() => setMenuOpenId((current) => (current === row.id ? null : row.id))}
                        type="button"
                      >
                        <Icon name="more_horiz" />
                      </button>
                      {menuOpenId === row.id && (
                        <div className="settings-menu">
                          <button onClick={() => { setMenuOpenId(null); notify(`Detalle de "${row.action}" registrado.`); }} type="button">
                            Ver detalle
                          </button>
                          <button onClick={() => { setMenuOpenId(null); notify("Registro exportado."); }} type="button">
                            Exportar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
