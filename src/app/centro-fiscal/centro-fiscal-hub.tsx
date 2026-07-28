"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import { paginateItems, paginationRangeLabel } from "@/lib/pagination";
import { matchesSearch } from "@/lib/tableSearch";
import { useModal } from "@/lib/useModal";
import {
  formatPreferenceDate,
  formatPreferenceMoney,
  formatPreferenceMonth,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

type MovementFilter = "all" | "ingresos" | "gastos" | "impuestos";
type MovementType = "Ingreso" | "Gasto" | "Impuesto";
type EventStatus = "Pendiente" | "Completado";

type Movement = {
  amount: number;
  category: string;
  date: string;
  description: string;
  id: string;
  status: "Pagado" | "Registrado";
  type: MovementType;
};

type FiscalEvent = {
  day: number;
  dueIn: string;
  id: string;
  month: number;
  status: EventStatus;
  title: string;
  year: number;
};

type RecentDoc = {
  amount: number;
  id: string;
  subtitle: string;
  title: string;
  tone: "negative" | "positive";
};

type TaxDue = {
  amount: number;
  dueDate: string;
  id: string;
  name: string;
};

export type CentroFiscalInitialData = {
  docs: RecentDoc[];
  events: FiscalEvent[];
  movements: Movement[];
  taxes: TaxDue[];
};

const FISCAL_MOVEMENTS_PAGE_SIZE = 5;
const RECENT_DOCS_PAGE_SIZE = 3;

const movementsSeed: Movement[] = [
  { id: "m1", date: "2026-07-18", description: "Factura F-2026-156", category: "Ventas", type: "Ingreso", amount: 5200, status: "Registrado" },
  { id: "m2", date: "2026-07-17", description: "Gasto: Papelería", category: "Operación", type: "Gasto", amount: 350, status: "Pagado" },
  { id: "m3", date: "2026-07-16", description: "Pago de impuestos SAT", category: "IVA", type: "Impuesto", amount: 7850, status: "Pagado" },
  { id: "m4", date: "2026-07-15", description: "Factura F-2026-149", category: "Servicios", type: "Ingreso", amount: 12800, status: "Registrado" },
  { id: "m5", date: "2026-07-14", description: "Nómina quincenal", category: "Personal", type: "Gasto", amount: 45250, status: "Pagado" },
  { id: "m6", date: "2026-07-12", description: "Retención ISR", category: "ISR", type: "Impuesto", amount: 5600, status: "Registrado" },
];

const eventsSeed: FiscalEvent[] = [
  { id: "e1", day: 15, month: 6, year: 2026, title: "Declaración mensual IVA", dueIn: "vence en 15 días", status: "Pendiente" },
  { id: "e2", day: 17, month: 6, year: 2026, title: "Pago provisional ISR", dueIn: "vence en 17 días", status: "Pendiente" },
  { id: "e3", day: 30, month: 6, year: 2026, title: "CFDI por emitir", dueIn: "vence en 30 días", status: "Pendiente" },
  { id: "e4", day: 20, month: 7, year: 2026, title: "Declaración mensual IVA", dueIn: "vence en 5 días", status: "Pendiente" },
  { id: "e5", day: 31, month: 7, year: 2026, title: "Cierre de periodo", dueIn: "vence en 12 días", status: "Pendiente" },
];

const docsSeed: RecentDoc[] = [
  { id: "d1", title: "Factura F-2026-156", subtitle: "Cliente Ejemplo · hoy", amount: 5200, tone: "positive" },
  { id: "d2", title: "Gasto: Papelería", subtitle: "Operaciones · ayer", amount: 350, tone: "negative" },
  { id: "d3", title: "Pago de impuestos SAT", subtitle: "IVA · 16 jul", amount: 7850, tone: "negative" },
  { id: "d4", title: "Factura F-2026-149", subtitle: "Servicios · 15 jul", amount: 12800, tone: "positive" },
];

const taxesSeed: TaxDue[] = [
  { id: "t1", name: "IVA mensual", dueDate: "2026-07-20", amount: 7850 },
  { id: "t2", name: "ISR provisional", dueDate: "2026-07-25", amount: 5600 },
  { id: "t3", name: "Retenciones salarios", dueDate: "2026-07-31", amount: 5000 },
];

const emptyInitialData: CentroFiscalInitialData = {
  docs: docsSeed,
  events: eventsSeed,
  movements: movementsSeed,
  taxes: taxesSeed,
};

const monthShort = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const sparkPaths = {
  income: "M0 18 L8 14 L16 16 L24 10 L32 12 L40 6 L48 8",
  expense: "M0 8 L8 12 L16 10 L24 14 L32 12 L40 16 L48 14",
  tax: "M0 14 L8 16 L16 12 L24 14 L32 10 L40 12 L48 8",
  docs: "M0 16 L8 14 L16 10 L24 12 L32 8 L40 10 L48 6",
};

function Sparkline({ path, tone }: { path: string; tone: "amber" | "deep" | "green" | "mint" }) {
  return (
    <svg aria-hidden="true" className={`cf-spark cf-spark-${tone}`} viewBox="0 0 48 20">
      <path d={path} />
    </svg>
  );
}

function calendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CentroFiscalHub({
  initialData = emptyInitialData,
  preferences,
  serverNow,
}: {
  initialData?: CentroFiscalInitialData;
  preferences: UserPreferences;
  serverNow: string;
}) {
  const baseDate = useMemo(() => new Date(serverNow), [serverNow]);
  const [calendarMonth, setCalendarMonth] = useState(baseDate.getMonth());
  const [calendarYear, setCalendarYear] = useState(baseDate.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(baseDate.getDate());
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [movementQuery, setMovementQuery] = useState("");
  const [movementPage, setMovementPage] = useState(1);
  const [docsPage, setDocsPage] = useState(1);
  const [movements, setMovements] = useState(initialData.movements);
  const [events, setEvents] = useState(initialData.events);
  const [docs, setDocs] = useState(initialData.docs);
  const [taxes] = useState(initialData.taxes);
  const [feedback, setFeedback] = useState("");
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [newActivity, setNewActivity] = useState({ title: "", day: String(baseDate.getDate()) });
  const dialogRef = useRef<HTMLElement>(null);
  const t = createTranslator(preferences.language);
  const closeActivityModal = () => setShowActivityModal(false);
  useModal({ dialogRef, onClose: closeActivityModal, open: showActivityModal });

  const monthIncome = movements.filter((m) => m.type === "Ingreso").reduce((s, m) => s + m.amount, 0);
  const monthExpense = movements.filter((m) => m.type === "Gasto").reduce((s, m) => s + m.amount, 0);
  const taxesDue = taxes.reduce((s, t) => s + t.amount, 0);
  const docsCount = docs.length + movements.filter((m) => m.type === "Ingreso").length;

  const stats = useMemo(
    () => [
      { label: t("fiscalCenter.incomeMonth"), value: formatPreferenceMoney(monthIncome, preferences), trend: t("fiscalCenter.previousMonthUp"), tone: "green" as const, icon: "trending_up", spark: sparkPaths.income },
      { label: t("fiscalCenter.expensesMonth"), value: formatPreferenceMoney(monthExpense, preferences), trend: t("fiscalCenter.previousMonthDown"), tone: "deep" as const, icon: "trending_down", spark: sparkPaths.expense },
      { label: t("fiscalCenter.taxesDue"), value: formatPreferenceMoney(taxesDue, preferences), trend: t("fiscalCenter.dueIn15"), tone: "amber" as const, icon: "percent", spark: sparkPaths.tax },
      { label: t("fiscalCenter.documentsIssued"), value: String(docsCount), trend: t("fiscalCenter.fiveThisMonth"), tone: "mint" as const, icon: "receipt_long", spark: sparkPaths.docs },
    ],
    [docsCount, monthExpense, monthIncome, preferences, t, taxesDue],
  );

  const filteredMovements = useMemo(() => {
    const byType = (() => {
      if (movementFilter === "all") return movements;
      if (movementFilter === "ingresos") return movements.filter((m) => m.type === "Ingreso");
      if (movementFilter === "gastos") return movements.filter((m) => m.type === "Gasto");
      return movements.filter((m) => m.type === "Impuesto");
    })();

    return byType.filter((movement) => matchesSearch([
      formatPreferenceDate(movement.date, preferences, movement.date),
      movement.date,
      movement.description,
      movement.category,
      movement.type,
      movement.status,
      movement.amount,
      formatPreferenceMoney(movement.amount, preferences),
    ], movementQuery));
  }, [movementFilter, movementQuery, movements, preferences]);
  const movementsPage = useMemo(
    () => paginateItems(filteredMovements, movementPage, FISCAL_MOVEMENTS_PAGE_SIZE),
    [filteredMovements, movementPage],
  );
  const paginatedDocs = useMemo(() => paginateItems(docs, docsPage, RECENT_DOCS_PAGE_SIZE), [docs, docsPage]);

  const monthEvents = events.filter((e) => e.month === calendarMonth && e.year === calendarYear);
  const eventDays = new Set(monthEvents.map((e) => e.day));
  const taxDays = new Set(monthEvents.filter((e) => e.title.toLowerCase().includes("iva") || e.title.toLowerCase().includes("isr")).map((e) => e.day));
  const cells = calendarCells(calendarYear, calendarMonth);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  }

  function typeLabel(type: MovementType) {
    if (preferences.language === "en") {
      if (type === "Ingreso") return "Income";
      if (type === "Gasto") return "Expense";
      return "Tax";
    }
    return type;
  }

  function statusLabel(status: Movement["status"] | EventStatus) {
    if (status === "Pagado") return t("fiscalCenter.paid");
    if (status === "Registrado") return t("common.registered");
    if (status === "Pendiente") return t("common.pending");
    return t("fiscalCenter.completed");
  }

  function shiftMonth(delta: number) {
    const date = new Date(calendarYear, calendarMonth + delta, 1);
    setCalendarMonth(date.getMonth());
    setCalendarYear(date.getFullYear());
    setSelectedDay(null);
  }

  function completeEvent(id: string) {
    setEvents((current) =>
      current.map((event) => (event.id === id ? { ...event, status: "Completado" } : event)),
    );
    notify(t("fiscalCenter.completedNotification"));
  }

  function addActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const day = Number(newActivity.day);
    if (!newActivity.title.trim() || !Number.isFinite(day) || day < 1 || day > 31) {
      notify(t("fiscalCenter.activityValidation"));
      return;
    }
    setEvents((current) => [
      {
        id: `e-${Date.now()}`,
        day,
        month: calendarMonth,
        year: calendarYear,
        title: newActivity.title.trim(),
        dueIn: preferences.language === "en" ? "just added" : "recién agregada",
        status: "Pendiente",
      },
      ...current,
    ]);
    setNewActivity({ title: "", day: String(day) });
    setShowActivityModal(false);
    notify(t("fiscalCenter.addedActivity"));
  }

  function addMovement(type: MovementType, description: string, amount: number) {
    setMovements((current) => [
      {
        id: `m-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        description,
        category: type === "Ingreso" ? t("fiscalCenter.incomeCategory") : type === "Gasto" ? t("fiscalCenter.expenseCategory") : t("fiscalCenter.taxCategory"),
        type,
        amount,
        status: "Registrado",
      },
      ...current,
    ]);
  }

  function quickAction(action: "comprobante" | "gasto" | "documento" | "reportes") {
    if (action === "comprobante") {
      addMovement("Ingreso", `Factura F-2026-${Math.floor(Math.random() * 900 + 100)}`, 4800);
      setDocs((current) => [
        { id: `d-${Date.now()}`, title: t("fiscalCenter.newReceiptTitle"), subtitle: t("fiscalCenter.generatedNow"), amount: 4800, tone: "positive" },
        ...current,
      ]);
      setDocsPage(1);
      notify(t("fiscalCenter.receiptAdded"));
      return;
    }
    if (action === "gasto") {
      addMovement("Gasto", t("fiscalCenter.operatingExpense"), 1200);
      notify(t("fiscalCenter.expenseAdded"));
      return;
    }
    if (action === "documento") {
      setDocs((current) => [
        { id: `d-${Date.now()}`, title: t("fiscalCenter.uploadedDoc"), subtitle: t("fiscalCenter.fiscalFileNow"), amount: 0, tone: "positive" },
        ...current,
      ]);
      setDocsPage(1);
      notify(t("fiscalCenter.documentAdded"));
      return;
    }
    setMovementFilter("all");
    setMovementPage(1);
    notify(t("fiscalCenter.reportShown"));
  }

  return (
    <div className="cf-page">
      {feedback && (
        <div className="cf-feedback" role="status">
          <Icon name="check_circle" />
          {feedback}
        </div>
      )}

      <header className="cf-header">
        <div>
          <p>{t("fiscalCenter.eyebrow")}</p>
          <h1>{t("fiscalCenter.title")}</h1>
          <span>{t("fiscalCenter.description")}</span>
        </div>
        <button className="cf-btn cf-btn-primary" onClick={() => setShowActivityModal(true)} type="button">
          <Icon name="add" />
          {t("fiscalCenter.newActivity")}
        </button>
      </header>

      <section className="cf-stats" aria-label={t("fiscalCenter.indicators")}>
        {stats.map((stat) => (
          <article className={`cf-stat cf-stat-${stat.tone}`} key={stat.label}>
            <div className="cf-stat-top">
              <span><Icon name={stat.icon} /></span>
              <small>{stat.label}</small>
              <strong>{stat.value}</strong>
              <em>{stat.trend}</em>
            </div>
            <Sparkline path={stat.spark} tone={stat.tone} />
          </article>
        ))}
      </section>

      <div className="cf-mid-grid">
        <section className="cf-panel">
          <div className="cf-panel-head">
            <h2>{t("fiscalCenter.calendar")}</h2>
            <div className="cf-calendar-nav">
              <button aria-label={t("fiscalCenter.previousMonth")} onClick={() => shiftMonth(-1)} type="button"><Icon name="keyboard_arrow_down" /></button>
              <span>{formatPreferenceMonth(new Date(calendarYear, calendarMonth, 1), preferences, true)}</span>
              <button aria-label={t("fiscalCenter.nextMonth")} onClick={() => shiftMonth(1)} type="button"><Icon name="keyboard_arrow_down" /></button>
            </div>
          </div>
          <div className="cf-calendar">
            <div className="cf-calendar-weekdays">
              {[
                ["lun", preferences.language === "en" ? "M" : "L"],
                ["mar", preferences.language === "en" ? "T" : "M"],
                ["mie", preferences.language === "en" ? "W" : "M"],
                ["jue", preferences.language === "en" ? "T" : "J"],
                ["vie", preferences.language === "en" ? "F" : "V"],
                ["sab", "S"],
                ["dom", "S"],
              ].map(([key, label]) => (
                <span key={key}>{label}</span>
              ))}
            </div>
            <div className="cf-calendar-grid">
              {cells.map((day, index) => (
                <button
                  className={[
                    day ? "has-day" : "is-empty",
                    day && eventDays.has(day) ? "has-event" : "",
                    day && taxDays.has(day) ? "has-tax" : "",
                    day === selectedDay ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                  disabled={!day}
                  key={`${calendarYear}-${calendarMonth}-${index}`}
                  onClick={() => day && setSelectedDay(day)}
                  type="button"
                >
                  {day ?? ""}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="cf-panel">
          <div className="cf-panel-head">
            <h2>{t("fiscalCenter.events")}</h2>
            <span>{t("fiscalCenter.pendingCount", { count: monthEvents.filter((e) => e.status === "Pendiente").length })}</span>
          </div>
          <ul className="cf-event-list">
            {monthEvents.length ? (
              monthEvents.map((event) => (
                <li key={event.id}>
                  <span className="cf-event-date">{event.day}<br />{monthShort[event.month]}</span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>{event.dueIn}</small>
                  </div>
                  {event.status === "Pendiente" ? (
                    <button className="cf-badge cf-badge-pending" onClick={() => completeEvent(event.id)} type="button">
                      {t("common.pending")}
                    </button>
                  ) : (
                    <span className="cf-badge cf-badge-done">{t("fiscalCenter.completed")}</span>
                  )}
                </li>
              ))
            ) : (
              <li className="cf-empty">{t("fiscalCenter.noEvents")}</li>
            )}
          </ul>
        </section>

        <section className="cf-panel">
          <div className="cf-panel-head">
            <h2>{t("fiscalCenter.recentDocs")}</h2>
            <span>{t("fiscalCenter.docsCount", { count: docs.length })}</span>
          </div>
          <ul className="cf-doc-list">
            {paginatedDocs.items.map((doc) => (
              <li key={doc.id}>
                <div>
                  <strong>{doc.title}</strong>
                  <small>{doc.subtitle}</small>
                </div>
                <em className={doc.tone === "positive" ? "is-positive" : "is-negative"}>
                  {doc.tone === "positive" ? "+" : "-"} {formatPreferenceMoney(doc.amount, preferences)}
                </em>
              </li>
            ))}
          </ul>
          {docs.length > RECENT_DOCS_PAGE_SIZE && (
            <nav className="table-pagination cf-doc-pagination" aria-label={t("pagination.label")}>
              <span>{t("pagination.showing", { range: paginationRangeLabel(docs.length, paginatedDocs.start, paginatedDocs.end, preferences.language) })}</span>
              <div>
                <button disabled={paginatedDocs.currentPage === 1} onClick={() => setDocsPage((value) => Math.max(1, value - 1))} type="button">
                  <Icon name="chevron_left" />
                </button>
                {Array.from({ length: paginatedDocs.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    className={pageNumber === paginatedDocs.currentPage ? "is-active" : undefined}
                    key={pageNumber}
                    onClick={() => setDocsPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ))}
                <button disabled={paginatedDocs.currentPage === paginatedDocs.totalPages} onClick={() => setDocsPage((value) => Math.min(paginatedDocs.totalPages, value + 1))} type="button">
                  <Icon name="chevron_right" />
                </button>
              </div>
            </nav>
          )}
        </section>
      </div>

      <div className="cf-bottom-grid">
        <section className="cf-panel cf-panel-wide">
          <div className="cf-panel-head">
            <h2>{t("fiscalCenter.recentMovements")}</h2>
            <div className="cf-table-tools">
              <label className="table-search">
                <Icon name="search" />
                <input
                  aria-label={t("fiscalCenter.searchMovements")}
                  onChange={(event) => {
                    setMovementQuery(event.target.value);
                    setMovementPage(1);
                  }}
                  placeholder={t("fiscalCenter.searchPlaceholder")}
                  type="search"
                  value={movementQuery}
                />
                {movementQuery && (
                  <button className="table-search-submit" onClick={() => { setMovementQuery(""); setMovementPage(1); }} type="button">
                    {t("button.clear")}
                  </button>
                )}
              </label>
              <div className="cf-tabs" role="tablist" aria-label={t("fiscalCenter.filterMovements")}>
                {([
                  ["all", t("fiscalCenter.all")],
                  ["ingresos", t("fiscalCenter.income")],
                  ["gastos", t("fiscalCenter.expenses")],
                  ["impuestos", t("fiscalCenter.taxes")],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    aria-selected={movementFilter === id}
                    className={movementFilter === id ? "is-active" : undefined}
                    onClick={() => {
                      setMovementFilter(id);
                      setMovementPage(1);
                    }}
                    role="tab"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="cf-table-wrap">
            <table className="cf-table">
              <thead>
                <tr>
                  <th>{t("table.date")}</th>
                  <th>{t("table.description")}</th>
                  <th>{t("table.category")}</th>
                  <th>{t("table.type")}</th>
                  <th>{t("table.amount")}</th>
                  <th>{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {movementsPage.items.length ? (
                  movementsPage.items.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatPreferenceDate(movement.date, preferences, movement.date)}</td>
                      <td>{movement.description}</td>
                      <td>{movement.category}</td>
                      <td>{typeLabel(movement.type)}</td>
                      <td>{formatPreferenceMoney(movement.amount, preferences)}</td>
                      <td>
                        <span className={`cf-status ${movement.status === "Pagado" ? "is-paid" : "is-registered"}`}>
                          {statusLabel(movement.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="reports-empty">
                        <span><Icon name="sync_alt" /></span>
                        <strong>{movementQuery ? t("fiscalCenter.noMovementsSearch") : t("fiscalCenter.noMovements")}</strong>
                        <small>{movementQuery ? t("common.tryAnotherSearch") : t("fiscalCenter.noMovementsHelp")}</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredMovements.length > FISCAL_MOVEMENTS_PAGE_SIZE && (
            <nav className="table-pagination" aria-label={t("pagination.label")}>
              <span>{t("pagination.showing", { range: paginationRangeLabel(filteredMovements.length, movementsPage.start, movementsPage.end, preferences.language) })}</span>
              <div>
                <button disabled={movementsPage.currentPage === 1} onClick={() => setMovementPage((value) => Math.max(1, value - 1))} type="button">
                  <Icon name="chevron_left" />
                </button>
                {Array.from({ length: movementsPage.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    className={pageNumber === movementsPage.currentPage ? "is-active" : undefined}
                    key={pageNumber}
                    onClick={() => setMovementPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ))}
                <button disabled={movementsPage.currentPage === movementsPage.totalPages} onClick={() => setMovementPage((value) => Math.min(movementsPage.totalPages, value + 1))} type="button">
                  <Icon name="chevron_right" />
                </button>
              </div>
            </nav>
          )}
        </section>

        <section className="cf-panel">
          <div className="cf-panel-head"><h2>{t("fiscalCenter.taxesExpiring")}</h2></div>
          <ul className="cf-tax-list">
            {taxes.map((tax) => (
              <li key={tax.id}>
                <div>
                  <strong>{tax.name}</strong>
                  <small>{formatPreferenceDate(tax.dueDate, preferences, tax.dueDate)}</small>
                </div>
                <em>{formatPreferenceMoney(tax.amount, preferences)}</em>
              </li>
            ))}
          </ul>
        </section>

        <section className="cf-panel">
          <div className="cf-panel-head"><h2>{t("fiscalCenter.quickActions")}</h2></div>
          <div className="cf-actions-grid">
            <button className="cf-action cf-action-green" onClick={() => quickAction("comprobante")} type="button">
              <Icon name="receipt_long" />
              {t("fiscalCenter.newReceipt")}
            </button>
            <button className="cf-action cf-action-deep" onClick={() => quickAction("gasto")} type="button">
              <Icon name="trending_down" />
              {t("fiscalCenter.registerExpense")}
            </button>
            <button className="cf-action cf-action-mint" onClick={() => quickAction("documento")} type="button">
              <Icon name="south" />
              {t("fiscalCenter.uploadDocument")}
            </button>
            <button className="cf-action cf-action-amber" onClick={() => quickAction("reportes")} type="button">
              <Icon name="bar_chart" />
              {t("fiscalCenter.viewReports")}
            </button>
          </div>
          <div className="cf-tip">
            <span><Icon name="help" /></span>
            <p><strong>{t("fiscalCenter.tip")}</strong> {t("fiscalCenter.tipText")}</p>
          </div>
        </section>
      </div>

      {showActivityModal && (
        <div className="cf-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeActivityModal(); }} role="presentation">
          <section aria-labelledby="cf-activity-title" aria-modal="true" className="cf-modal" ref={dialogRef} role="dialog" tabIndex={-1}>
            <header>
              <div>
                <span>{t("fiscalCenter.modalEyebrow")}</span>
                <h2 id="cf-activity-title">{t("fiscalCenter.modalTitle")}</h2>
              </div>
              <button aria-label={t("button.close")} onClick={closeActivityModal} type="button">×</button>
            </header>
            <form onSubmit={addActivity}>
              <label>
                {t("fiscalCenter.activityTitle")}
                <input onChange={(e) => setNewActivity((v) => ({ ...v, title: e.target.value }))} placeholder={t("fiscalCenter.activityPlaceholder")} required value={newActivity.title} />
              </label>
              <label>
                {t("fiscalCenter.dayOfMonth")}
                <input max="31" min="1" onChange={(e) => setNewActivity((v) => ({ ...v, day: e.target.value }))} required type="number" value={newActivity.day} />
              </label>
              <button className="cf-btn cf-btn-primary" type="submit">{t("fiscalCenter.saveActivity")}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
