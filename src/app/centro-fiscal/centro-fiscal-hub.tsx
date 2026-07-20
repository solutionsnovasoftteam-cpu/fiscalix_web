"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useModal } from "@/lib/useModal";

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

const money = new Intl.NumberFormat("es-MX", { currency: "MXN", style: "currency" });
const monthFmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" });

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

export function CentroFiscalHub({ serverNow }: { serverNow: string }) {
  const baseDate = useMemo(() => new Date(serverNow), [serverNow]);
  const [calendarMonth, setCalendarMonth] = useState(baseDate.getMonth());
  const [calendarYear, setCalendarYear] = useState(baseDate.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(baseDate.getDate());
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [movements, setMovements] = useState(movementsSeed);
  const [events, setEvents] = useState(eventsSeed);
  const [docs, setDocs] = useState(docsSeed);
  const [feedback, setFeedback] = useState("");
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [newActivity, setNewActivity] = useState({ title: "", day: String(baseDate.getDate()) });
  const dialogRef = useRef<HTMLElement>(null);
  const closeActivityModal = () => setShowActivityModal(false);
  useModal({ dialogRef, onClose: closeActivityModal, open: showActivityModal });

  const monthIncome = movements.filter((m) => m.type === "Ingreso").reduce((s, m) => s + m.amount, 0);
  const monthExpense = movements.filter((m) => m.type === "Gasto").reduce((s, m) => s + m.amount, 0);
  const taxesDue = taxesSeed.reduce((s, t) => s + t.amount, 0);
  const docsCount = docs.length + movements.filter((m) => m.type === "Ingreso").length;

  const stats = useMemo(
    () => [
      { label: "Ingresos del mes", value: money.format(monthIncome), trend: "+ 12% vs. mes anterior", tone: "green" as const, icon: "trending_up", spark: sparkPaths.income },
      { label: "Gastos del mes", value: money.format(monthExpense), trend: "- 8% vs. mes anterior", tone: "deep" as const, icon: "trending_down", spark: sparkPaths.expense },
      { label: "Impuestos por pagar", value: money.format(taxesDue), trend: "Vence en 15 días", tone: "amber" as const, icon: "percent", spark: sparkPaths.tax },
      { label: "Documentos emitidos", value: String(docsCount), trend: "↑ 5 este mes", tone: "mint" as const, icon: "receipt_long", spark: sparkPaths.docs },
    ],
    [docsCount, monthExpense, monthIncome, taxesDue],
  );

  const filteredMovements = useMemo(() => {
    if (movementFilter === "all") return movements;
    if (movementFilter === "ingresos") return movements.filter((m) => m.type === "Ingreso");
    if (movementFilter === "gastos") return movements.filter((m) => m.type === "Gasto");
    return movements.filter((m) => m.type === "Impuesto");
  }, [movementFilter, movements]);

  const monthEvents = events.filter((e) => e.month === calendarMonth && e.year === calendarYear);
  const eventDays = new Set(monthEvents.map((e) => e.day));
  const taxDays = new Set(monthEvents.filter((e) => e.title.toLowerCase().includes("iva") || e.title.toLowerCase().includes("isr")).map((e) => e.day));
  const cells = calendarCells(calendarYear, calendarMonth);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
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
    notify("Obligación marcada como completada.");
  }

  function addActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const day = Number(newActivity.day);
    if (!newActivity.title.trim() || !Number.isFinite(day) || day < 1 || day > 31) {
      notify("Completa título y día válido.");
      return;
    }
    setEvents((current) => [
      {
        id: `e-${Date.now()}`,
        day,
        month: calendarMonth,
        year: calendarYear,
        title: newActivity.title.trim(),
        dueIn: "recién agregada",
        status: "Pendiente",
      },
      ...current,
    ]);
    setNewActivity({ title: "", day: String(day) });
    setShowActivityModal(false);
    notify("Actividad fiscal agregada al calendario.");
  }

  function addMovement(type: MovementType, description: string, amount: number) {
    setMovements((current) => [
      {
        id: `m-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        description,
        category: type === "Ingreso" ? "Ventas" : type === "Gasto" ? "Operación" : "Impuestos",
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
        { id: `d-${Date.now()}`, title: "Nuevo comprobante", subtitle: "Generado ahora", amount: 4800, tone: "positive" },
        ...current,
      ]);
      notify("Comprobante registrado en movimientos.");
      return;
    }
    if (action === "gasto") {
      addMovement("Gasto", "Gasto operativo", 1200);
      notify("Gasto registrado correctamente.");
      return;
    }
    if (action === "documento") {
      setDocs((current) => [
        { id: `d-${Date.now()}`, title: "Documento cargado", subtitle: "Archivo fiscal · ahora", amount: 0, tone: "positive" },
        ...current,
      ]);
      notify("Documento agregado a recientes.");
      return;
    }
    setMovementFilter("all");
    notify("Mostrando reporte completo de movimientos.");
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
          <p>CENTRO DE CONTROL</p>
          <h1>Centro fiscal</h1>
          <span>Gestiona todas tus obligaciones, documentos y actividades fiscales desde un solo lugar.</span>
        </div>
        <button className="cf-btn cf-btn-primary" onClick={() => setShowActivityModal(true)} type="button">
          <Icon name="add" />
          Nueva actividad
        </button>
      </header>

      <section className="cf-stats" aria-label="Indicadores fiscales">
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
            <h2>Calendario fiscal</h2>
            <div className="cf-calendar-nav">
              <button aria-label="Mes anterior" onClick={() => shiftMonth(-1)} type="button"><Icon name="keyboard_arrow_down" /></button>
              <span>{monthFmt.format(new Date(calendarYear, calendarMonth, 1))}</span>
              <button aria-label="Mes siguiente" onClick={() => shiftMonth(1)} type="button"><Icon name="keyboard_arrow_down" /></button>
            </div>
          </div>
          <div className="cf-calendar">
            <div className="cf-calendar-weekdays">
              {[
                ["lun", "L"],
                ["mar", "M"],
                ["mie", "M"],
                ["jue", "J"],
                ["vie", "V"],
                ["sab", "S"],
                ["dom", "D"],
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
            <h2>Eventos y obligaciones</h2>
            <span>{monthEvents.filter((e) => e.status === "Pendiente").length} pendientes</span>
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
                      Pendiente
                    </button>
                  ) : (
                    <span className="cf-badge cf-badge-done">Completado</span>
                  )}
                </li>
              ))
            ) : (
              <li className="cf-empty">No hay eventos en este mes.</li>
            )}
          </ul>
        </section>

        <section className="cf-panel">
          <div className="cf-panel-head">
            <h2>Documentos recientes</h2>
            <button className="cf-link-btn" onClick={() => notify("Mostrando todos los documentos.")} type="button">Ver todos</button>
          </div>
          <ul className="cf-doc-list">
            {docs.map((doc) => (
              <li key={doc.id}>
                <div>
                  <strong>{doc.title}</strong>
                  <small>{doc.subtitle}</small>
                </div>
                <em className={doc.tone === "positive" ? "is-positive" : "is-negative"}>
                  {doc.tone === "positive" ? "+" : "-"} {money.format(doc.amount)}
                </em>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="cf-bottom-grid">
        <section className="cf-panel cf-panel-wide">
          <div className="cf-panel-head">
            <h2>Movimientos recientes</h2>
            <div className="cf-tabs" role="tablist" aria-label="Filtrar movimientos">
              {([
                ["all", "Todos"],
                ["ingresos", "Ingresos"],
                ["gastos", "Gastos"],
                ["impuestos", "Impuestos"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  aria-selected={movementFilter === id}
                  className={movementFilter === id ? "is-active" : undefined}
                  onClick={() => setMovementFilter(id)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="cf-table-wrap">
            <table className="cf-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{dayFmt.format(new Date(`${movement.date}T12:00:00`))}</td>
                    <td>{movement.description}</td>
                    <td>{movement.category}</td>
                    <td>{movement.type}</td>
                    <td>{money.format(movement.amount)}</td>
                    <td>
                      <span className={`cf-status ${movement.status === "Pagado" ? "is-paid" : "is-registered"}`}>
                        {movement.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cf-panel">
          <div className="cf-panel-head"><h2>Impuestos por vencer</h2></div>
          <ul className="cf-tax-list">
            {taxesSeed.map((tax) => (
              <li key={tax.id}>
                <div>
                  <strong>{tax.name}</strong>
                  <small>{dayFmt.format(new Date(`${tax.dueDate}T12:00:00`))}</small>
                </div>
                <em>{money.format(tax.amount)}</em>
              </li>
            ))}
          </ul>
        </section>

        <section className="cf-panel">
          <div className="cf-panel-head"><h2>Acciones rápidas</h2></div>
          <div className="cf-actions-grid">
            <button className="cf-action cf-action-green" onClick={() => quickAction("comprobante")} type="button">
              <Icon name="receipt_long" />
              Nuevo comprobante
            </button>
            <button className="cf-action cf-action-deep" onClick={() => quickAction("gasto")} type="button">
              <Icon name="trending_down" />
              Registrar gasto
            </button>
            <button className="cf-action cf-action-mint" onClick={() => quickAction("documento")} type="button">
              <Icon name="south" />
              Subir documento
            </button>
            <button className="cf-action cf-action-amber" onClick={() => quickAction("reportes")} type="button">
              <Icon name="bar_chart" />
              Ver reportes
            </button>
          </div>
          <div className="cf-tip">
            <span><Icon name="help" /></span>
            <p><strong>Tip Fiscal:</strong> Mantén tus documentos al día y evita multas o recargos. ¡Tú puedes!</p>
          </div>
        </section>
      </div>

      {showActivityModal && (
        <div className="cf-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeActivityModal(); }} role="presentation">
          <section aria-labelledby="cf-activity-title" aria-modal="true" className="cf-modal" ref={dialogRef} role="dialog" tabIndex={-1}>
            <header>
              <div>
                <span>NUEVA ACTIVIDAD</span>
                <h2 id="cf-activity-title">Agregar al calendario fiscal</h2>
              </div>
              <button aria-label="Cerrar" onClick={closeActivityModal} type="button">×</button>
            </header>
            <form onSubmit={addActivity}>
              <label>
                Título de la actividad
                <input onChange={(e) => setNewActivity((v) => ({ ...v, title: e.target.value }))} placeholder="Ej. Declaración mensual IVA" required value={newActivity.title} />
              </label>
              <label>
                Día del mes
                <input max="31" min="1" onChange={(e) => setNewActivity((v) => ({ ...v, day: e.target.value }))} required type="number" value={newActivity.day} />
              </label>
              <button className="cf-btn cf-btn-primary" type="submit">Guardar actividad</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
