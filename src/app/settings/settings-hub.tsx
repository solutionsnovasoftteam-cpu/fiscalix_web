"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { paginateItems, paginationRangeLabel, TABLE_PAGE_SIZE } from "@/lib/pagination";

type Theme = "dark" | "light";
export type ActivityRow = {
  action: string;
  date: string;
  description: string;
  id: string;
  module: string;
  user: string;
};

export type SettingsInitialData = {
  activity: ActivityRow[];
  userName: string;
};

const quickLinks = [
  { href: "/companies", id: "company", icon: "business", title: "Mi empresa", text: "Datos fiscales y contacto" },
  { id: "users", icon: "manage_accounts", title: "Usuarios y permisos", text: "Roles y accesos del equipo", target: "settings-security" },
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
  const [activityPageNumber, setActivityPageNumber] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [twoFactor, setTwoFactor] = useState(true);
  const [theme, setTheme] = useState<Theme>("dark");
  const [lastBackup, setLastBackup] = useState("Pendiente de realizar");
  const [activity, setActivity] = useState<ActivityRow[]>(initialData?.activity ?? []);

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

  const filteredActivity = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return activity;
    return activity.filter((row) =>
      [row.date, row.user, row.action, row.module, row.description].join(" ").toLowerCase().includes(term),
    );
  }, [activity, query]);
  const activityPage = useMemo(() => paginateItems(filteredActivity, activityPageNumber, TABLE_PAGE_SIZE), [activityPageNumber, filteredActivity]);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveChanges() {
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
              onChange={(event) => {
                setQuery(event.target.value);
                setActivityPageNumber(1);
              }}
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
          "href" in link ? (
            <a className="settings-quick-card" href={link.href} key={link.id}>
              <span><Icon name={link.icon} /></span>
              <strong>{link.title}</strong>
              <small>{link.text}</small>
              <em>Abrir <Icon name="arrow_forward" /></em>
            </a>
          ) : (
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
          )
        ))}
      </section>

      <div className="settings-grid">
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
          <span className="receipts-count">{filteredActivity.length} registro{filteredActivity.length === 1 ? "" : "s"}</span>
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
              {filteredActivity.length === 0 ? (
                <tr>
                  <td className="settings-empty" colSpan={6}>No hay registros que coincidan con tu búsqueda.</td>
                </tr>
              ) : (
                activityPage.items.map((row) => (
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
        {filteredActivity.length > TABLE_PAGE_SIZE && (
          <nav className="table-pagination" aria-label="Paginación de actividad">
            <span>Mostrando {paginationRangeLabel(filteredActivity.length, activityPage.start, activityPage.end)}</span>
            <div>
              <button disabled={activityPage.currentPage === 1} onClick={() => setActivityPageNumber((value) => Math.max(1, value - 1))} type="button">
                <Icon name="chevron_left" />
              </button>
              {Array.from({ length: activityPage.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  className={pageNumber === activityPage.currentPage ? "is-active" : undefined}
                  key={pageNumber}
                  onClick={() => setActivityPageNumber(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              ))}
              <button disabled={activityPage.currentPage === activityPage.totalPages} onClick={() => setActivityPageNumber((value) => Math.min(activityPage.totalPages, value + 1))} type="button">
                <Icon name="chevron_right" />
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
