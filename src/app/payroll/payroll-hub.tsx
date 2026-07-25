"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { getCurrentPayCycle, getQuincenaByOffset, type PayrollRun } from "@/app/payroll/payroll-dates";
import { downloadPayrollPdf } from "@/app/payroll/payroll-pdf";
import { notifyPdfDownload } from "@/lib/clientNotifications";
import { paginationRangeLabel } from "@/lib/pagination";

export type PayrollEmployee = {
  department: string;
  id: string;
  initials: string;
  name: string;
  role: string;
  salary: number;
  status: "Activo" | "Baja";
};

export type PayrollHubInitialData = {
  employees?: PayrollEmployee[];
  history?: PayrollRun[];
};

type PayrollEmployeeResponse = {
  employee?: PayrollEmployee;
  message?: string;
  success?: boolean;
};

type PayrollRunResponse = {
  message?: string;
  run?: PayrollRun;
  success?: boolean;
};

const money = new Intl.NumberFormat("es-MX", { currency: "MXN", style: "currency" });
const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const PAGE_SIZE = 10;

async function requestJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as T & { message?: string };

  if (!response.ok) {
    throw new Error(payload.message || "No fue posible completar la operación.");
  }

  return payload;
}

export function PayrollHub({
  databaseStatusMessage = "",
  initialData,
}: {
  databaseStatusMessage?: string;
  initialData?: PayrollHubInitialData;
}) {
  const [employees, setEmployees] = useState<PayrollEmployee[]>(() => initialData?.employees ?? []);
  const [history, setHistory] = useState<PayrollRun[]>(() => initialData?.history ?? []);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: "", role: "", department: "", salary: "" });
  const [editEmployee, setEditEmployee] = useState({ name: "", role: "", department: "", salary: "" });

  const payCycle = useMemo(() => getCurrentPayCycle(), []);
  const activeEmployees = employees.filter((employee) => employee.status === "Activo");
  const totalPayroll = activeEmployees.reduce((sum, employee) => sum + employee.salary, 0);
  const perceptions = Math.round(totalPayroll * 1.26);
  const deductions = perceptions - totalPayroll;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      [employee.name, employee.role, employee.department].join(" ").toLowerCase().includes(term),
    );
  }, [employees, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice(pageStart, pageEnd);
  const visibleHistory = showAllHistory ? history : history.slice(0, 4);
  const isDatabaseBlocked = Boolean(databaseStatusMessage);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  }

  function closeMenu() {
    setMenuOpenId(null);
    setMenuPosition(null);
  }

  useEffect(() => {
    if (!menuOpenId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".payroll-row-actions") || target.closest(".payroll-menu")) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpenId]);

  async function savePayrollRun(run: Omit<PayrollRun, "downloaded" | "id">) {
    const payload = await requestJson<PayrollRunResponse>("/api/payroll/runs", {
      body: JSON.stringify(run),
      method: "POST",
    });

    if (!payload.run) throw new Error(payload.message || "No fue posible guardar la nómina.");
    return payload.run;
  }

  async function generatePayroll() {
    if (activeEmployees.length === 0) {
      notify("Agrega empleados activos antes de generar una nómina.");
      return;
    }

    const quincena = getQuincenaByOffset(0);
    const folio = `NOM-${quincena.folioPart}-R${history.length + 1}`;
    setIsSaving(true);
    try {
      const run = await savePayrollRun({
        folio,
        period: quincena.period,
        payDate: new Date().toISOString().slice(0, 10),
        employees: activeEmployees.length,
        perceptions,
        deductions,
        paid: totalPayroll,
        status: "Pagado",
      });
      setHistory((current) => [run, ...current]);
      notify(`Nómina ${run.folio} generada por ${money.format(run.paid)}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible guardar la nómina.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createPaymentDraft() {
    if (activeEmployees.length === 0) {
      notify("Agrega empleados activos antes de crear un pago.");
      return;
    }

    const quincena = getQuincenaByOffset(0);
    const folio = `NOM-BOR-${quincena.folioPart}-${history.length + 1}`;
    setIsSaving(true);
    try {
      const run = await savePayrollRun({
        folio,
        period: quincena.period,
        payDate: new Date().toISOString().slice(0, 10),
        employees: activeEmployees.length,
        perceptions,
        deductions,
        paid: totalPayroll,
        status: "Borrador",
      });
      setHistory((current) => [run, ...current]);
      notify(`Borrador ${run.folio} creado. Puedes generarlo cuando estés listo.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible crear el borrador.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salary = Number(newEmployee.salary);
    if (!newEmployee.name.trim() || !Number.isFinite(salary) || salary <= 0) {
      notify("Completa nombre y sueldo válido para agregar empleado.");
      return;
    }

    const name = newEmployee.name.trim();
    setIsSaving(true);
    try {
      const payload = await requestJson<PayrollEmployeeResponse>("/api/payroll/employees", {
        body: JSON.stringify({
          department: newEmployee.department,
          name,
          role: newEmployee.role,
          salary,
        }),
        method: "POST",
      });

      if (!payload.employee) throw new Error(payload.message || "No fue posible guardar el empleado.");

      setEmployees((current) => [payload.employee!, ...current]);
      setNewEmployee({ name: "", role: "", department: "", salary: "" });
      setShowEmployeeForm(false);
      setPage(1);
      notify(`${payload.employee.name} agregado a la plantilla.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible guardar el empleado.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditEmployee(id: string) {
    const employee = employees.find((item) => item.id === id);
    if (!employee) return;
    setEditingEmployeeId(id);
    setEditEmployee({
      name: employee.name,
      role: employee.role,
      department: employee.department,
      salary: String(employee.salary),
    });
    setShowEmployeeForm(false);
    closeMenu();
  }

  async function saveEmployeeEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEmployeeId) return;
    const salary = Number(editEmployee.salary);
    if (!editEmployee.name.trim() || !Number.isFinite(salary) || salary <= 0) {
      notify("Completa nombre y sueldo válido para guardar cambios.");
      return;
    }

    const name = editEmployee.name.trim();
    setIsSaving(true);
    try {
      const payload = await requestJson<PayrollEmployeeResponse>(`/api/payroll/employees/${editingEmployeeId}`, {
        body: JSON.stringify({
          department: editEmployee.department,
          name,
          role: editEmployee.role,
          salary,
        }),
        method: "PATCH",
      });

      if (!payload.employee) throw new Error(payload.message || "No fue posible actualizar el empleado.");

      setEmployees((current) => current.map((employee) => employee.id === editingEmployeeId ? payload.employee! : employee));
      setEditingEmployeeId(null);
      setEditEmployee({ name: "", role: "", department: "", salary: "" });
      notify(`${payload.employee.name} actualizado correctamente.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible actualizar el empleado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeEmployee(id: string) {
    const employee = employees.find((item) => item.id === id);
    setIsSaving(true);
    try {
      await requestJson<{ message?: string; success?: boolean }>(`/api/payroll/employees/${id}`, {
        method: "DELETE",
      });
      setEmployees((current) => current.filter((item) => item.id !== id));
      if (editingEmployeeId === id) setEditingEmployeeId(null);
      closeMenu();
      notify(employee ? `${employee.name} eliminado de la plantilla.` : "Empleado eliminado.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible eliminar el empleado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleEmployeeStatus(id: string) {
    const employee = employees.find((item) => item.id === id);
    if (!employee) return;

    const nextStatus = employee.status === "Activo" ? "baja" : "activo";
    setIsSaving(true);
    try {
      const payload = await requestJson<PayrollEmployeeResponse>(`/api/payroll/employees/${id}`, {
        body: JSON.stringify({ status: nextStatus }),
        method: "PATCH",
      });

      if (!payload.employee) throw new Error(payload.message || "No fue posible actualizar el estado.");

      setEmployees((current) => current.map((item) => item.id === id ? payload.employee! : item));
      closeMenu();
      notify("Estado del empleado actualizado.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible actualizar el estado.");
    } finally {
      setIsSaving(false);
    }
  }

  function openEmployeeMenu(event: React.MouseEvent<HTMLButtonElement>, id: string) {
    if (menuOpenId === id) {
      closeMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuOpenId(id);
    setMenuPosition({ top: rect.bottom + 6, left: Math.max(12, rect.right - 148) });
  }

  async function processDraft(id: string) {
    const run = history.find((item) => item.id === id);
    setIsSaving(true);
    try {
      const payload = await requestJson<PayrollRunResponse>(`/api/payroll/runs/${id}`, {
        body: JSON.stringify({ status: "Pagado" }),
        method: "PATCH",
      });
      if (!payload.run) throw new Error(payload.message || "No fue posible procesar el borrador.");
      setHistory((current) => current.map((item) => (item.id === id ? payload.run! : item)));
      notify(`${payload.run.folio} procesado y marcado como pagado.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : run ? `No fue posible procesar ${run.folio}.` : "No fue posible procesar el borrador.");
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadRun(id: string) {
    const run = history.find((item) => item.id === id);
    if (!run) {
      notify("No se encontró la nómina para descargar.");
      return;
    }

    try {
      await downloadPayrollPdf(run);
      await notifyPdfDownload("payroll", { folio: run.folio, recordCount: run.employees });
      await requestJson<PayrollRunResponse>(`/api/payroll/runs/${id}`, {
        body: JSON.stringify({ downloaded: true }),
        method: "PATCH",
      });
      setHistory((current) =>
        current.map((item) => (item.id === id ? { ...item, downloaded: true } : item)),
      );
      notify(`${run.folio}.pdf descargado.`);
    } catch {
      notify("No se pudo generar el PDF. Intenta de nuevo.");
    }
  }

  const openMenuEmployee = menuOpenId ? employees.find((employee) => employee.id === menuOpenId) : null;

  return (
    <div className="payroll-page">
      {feedback && (
        <div className="payroll-feedback" role="status">
          <Icon name="check_circle" />
          {feedback}
        </div>
      )}
      {databaseStatusMessage && (
        <div className="payroll-feedback payroll-feedback-warning" role="alert">
          <Icon name="info" />
          {databaseStatusMessage}
        </div>
      )}

      <header className="payroll-header">
        <div>
          <p className="payroll-eyebrow">{payCycle.eyebrow}</p>
          <h1>Nómina</h1>
          <span>Gestiona empleados, percepciones y dispersiones.</span>
        </div>
        <div className="payroll-header-actions">
          <label className="payroll-search">
            <Icon name="search" />
            <input
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar empleado..."
              type="search"
              value={query}
            />
          </label>
          <button className="payroll-btn payroll-btn-primary" disabled={isSaving || isDatabaseBlocked} onClick={createPaymentDraft} type="button">
            <Icon name="add" />
            Nuevo pago
          </button>
        </div>
      </header>

      <section className="payroll-kpis" aria-label="Indicadores">
        <article>
          <small>Total empleados</small>
          <strong>{activeEmployees.length}</strong>
          <span className="payroll-kpi-caption">Activos</span>
          <span className="payroll-kpi-icon">
            <Icon name="person" />
          </span>
        </article>
        <article className="is-accent">
          <small>Total a pagar</small>
          <strong>{money.format(totalPayroll)}</strong>
          <span className="payroll-kpi-caption">Quincena actual</span>
          <span className="payroll-kpi-icon">
            <Icon name="payments" />
          </span>
        </article>
        <article>
          <small>Nóminas procesadas</small>
          <strong>{history.filter((run) => run.status === "Pagado").length}</strong>
          <span className="payroll-kpi-caption">Registradas</span>
          <span className="payroll-kpi-icon">
            <Icon name="fact_check" />
          </span>
        </article>
        <article>
          <small>Próximo pago</small>
          <strong>{payCycle.shortPayDay}</strong>
          <span className="payroll-kpi-caption">{payCycle.shortPayYear}</span>
          <span className="payroll-kpi-icon">
            <Icon name="event_note" />
          </span>
        </article>
      </section>

      <div className="payroll-layout">
        <section className="payroll-panel payroll-panel-wide">
          <div className="payroll-panel-head">
            <div>
              <h2>Empleados</h2>
              <p>{paginationRangeLabel(filtered.length, pageStart, pageEnd)} en plantilla · página {currentPage} de {totalPages}</p>
            </div>
            <button className="payroll-btn payroll-btn-secondary" disabled={isSaving || isDatabaseBlocked} onClick={() => { setShowEmployeeForm((open) => !open); setEditingEmployeeId(null); }} type="button">
              <Icon name="add" />
              {showEmployeeForm ? "Cancelar" : "Nuevo empleado"}
            </button>
          </div>

          {editingEmployeeId && (
            <form className="payroll-form" onSubmit={saveEmployeeEdit}>
              <input onChange={(event) => setEditEmployee((value) => ({ ...value, name: event.target.value }))} placeholder="Nombre completo" required value={editEmployee.name} />
              <input onChange={(event) => setEditEmployee((value) => ({ ...value, role: event.target.value }))} placeholder="Puesto" value={editEmployee.role} />
              <input onChange={(event) => setEditEmployee((value) => ({ ...value, department: event.target.value }))} placeholder="Departamento" value={editEmployee.department} />
              <input min="1" onChange={(event) => setEditEmployee((value) => ({ ...value, salary: event.target.value }))} placeholder="Sueldo bruto" required step="0.01" type="number" value={editEmployee.salary} />
              <button className="payroll-btn payroll-btn-primary" disabled={isSaving} type="submit">Guardar cambios</button>
              <button className="payroll-btn payroll-btn-secondary" disabled={isSaving} onClick={() => setEditingEmployeeId(null)} type="button">Cancelar edición</button>
            </form>
          )}

          {showEmployeeForm && (
            <form className="payroll-form" onSubmit={addEmployee}>
              <input onChange={(event) => setNewEmployee((value) => ({ ...value, name: event.target.value }))} placeholder="Nombre completo" required value={newEmployee.name} />
              <input onChange={(event) => setNewEmployee((value) => ({ ...value, role: event.target.value }))} placeholder="Puesto" value={newEmployee.role} />
              <input onChange={(event) => setNewEmployee((value) => ({ ...value, department: event.target.value }))} placeholder="Departamento" value={newEmployee.department} />
              <input min="1" onChange={(event) => setNewEmployee((value) => ({ ...value, salary: event.target.value }))} placeholder="Sueldo bruto" required step="0.01" type="number" value={newEmployee.salary} />
              <button className="payroll-btn payroll-btn-primary" disabled={isSaving} type="submit">Guardar empleado</button>
            </form>
          )}

          <div className="payroll-table-wrap">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Puesto</th>
                  <th>Departamento</th>
                  <th>Sueldo</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {pageItems.length > 0 ? (
                  pageItems.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <span className="payroll-avatar">
                          {employee.initials}
                        </span>
                        <strong>{employee.name}</strong>
                      </td>
                      <td>{employee.role}</td>
                      <td>{employee.department}</td>
                      <td>{money.format(employee.salary)}</td>
                      <td><span className={`payroll-status ${employee.status === "Activo" ? "active" : "inactive"}`}>{employee.status}</span></td>
                      <td className="payroll-row-actions">
                        <button
                          aria-expanded={menuOpenId === employee.id}
                          aria-haspopup="menu"
                          aria-label={`Opciones de ${employee.name}`}
                          className="payroll-icon-btn"
                          disabled={isSaving}
                          onClick={(event) => openEmployeeMenu(event, employee.id)}
                          type="button"
                        >
                          <span aria-hidden="true">⋯</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="payroll-empty-cell" colSpan={6}>
                      <div className="payroll-empty">
                        <span><Icon name="person" /></span>
                        <strong>No hay empleados registrados</strong>
                        <small>Agrega empleados reales para comenzar a gestionar la nómina.</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className="payroll-pages" aria-label="Paginación">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  className={pageNumber === currentPage ? "is-active" : undefined}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              ))}
            </nav>
          )}
        </section>

        <aside className="payroll-panel payroll-panel-slip">
          <h2>Próximo pago</h2>
          <p className="payroll-slip-total">{money.format(totalPayroll)}</p>
          <ul className="payroll-slip-lines">
            <li><span>Fecha</span><strong>{payCycle.shortPayDay} {payCycle.shortPayYear}</strong></li>
            <li><span>Periodo</span><strong>{payCycle.period}</strong></li>
            <li><span>Empleados</span><strong>{activeEmployees.length}</strong></li>
            <li><span>Percepciones</span><strong>{money.format(perceptions)}</strong></li>
            <li><span>Deducciones</span><strong>{money.format(deductions)}</strong></li>
          </ul>
          <button className="payroll-btn payroll-btn-primary payroll-btn-block" disabled={isSaving || isDatabaseBlocked} onClick={generatePayroll} type="button">
            <Icon name="payments" />
            Generar nómina
          </button>
        </aside>
      </div>

      <section className="payroll-panel payroll-history">
        <div className="payroll-panel-head">
          <div>
            <h2>Historial de nóminas</h2>
            <p>{history.length} registros</p>
          </div>
          {history.length > 4 ? (
            <button className="payroll-btn payroll-btn-secondary" onClick={() => setShowAllHistory((value) => !value)} type="button">
              {showAllHistory ? "Ver menos" : "Ver todas"}
            </button>
          ) : null}
        </div>
        <div className="payroll-history-grid">
          {visibleHistory.length > 0 ? (
            visibleHistory.map((run) => (
              <article className="payroll-history-card" key={run.id}>
                <header>
                  <span className="payroll-history-title">
                    <span className="payroll-history-icon">
                      <Icon name={run.status === "Pagado" ? "check_circle" : "history"} />
                    </span>
                    <strong>{run.folio}</strong>
                  </span>
                  <span className={`payroll-status ${run.status === "Pagado" ? "active" : "pending"}`}>{run.status}</span>
                </header>
                <p>{run.period}</p>
                <small>Pago · {dateFmt.format(new Date(`${run.payDate}T00:00:00`))}</small>
                <div className="payroll-history-meta">
                  <span>{run.employees} empleados</span>
                  <em>{money.format(run.paid)}</em>
                </div>
                {run.status === "Borrador" && (
                  <button className="payroll-btn payroll-btn-primary" disabled={isSaving} onClick={() => processDraft(run.id)} type="button">
                    <Icon name="payments" />
                    Procesar borrador
                  </button>
                )}
                <button
                  className={`payroll-btn payroll-btn-secondary ${run.downloaded ? "is-done" : ""}`}
                  disabled={isSaving}
                  onClick={() => downloadRun(run.id)}
                  type="button"
                >
                  <Icon name="south" />
                  {run.downloaded ? "PDF descargado" : "Descargar PDF"}
                </button>
              </article>
            ))
          ) : (
            <div className="payroll-empty payroll-history-empty">
              <span><Icon name="history" /></span>
              <strong>No hay nóminas registradas</strong>
              <small>Cuando generes nóminas reales, aparecerán en este historial.</small>
            </div>
          )}
        </div>
      </section>

      {menuOpenId && menuPosition && openMenuEmployee && (
        <div
          className="payroll-menu payroll-menu-floating"
          role="menu"
          style={{ position: "fixed", left: menuPosition.left, top: menuPosition.top, zIndex: 100 }}
        >
          <button disabled={isSaving} onClick={() => startEditEmployee(openMenuEmployee.id)} role="menuitem" type="button">
            Editar empleado
          </button>
          <button disabled={isSaving} onClick={() => toggleEmployeeStatus(openMenuEmployee.id)} role="menuitem" type="button">
            {openMenuEmployee.status === "Activo" ? "Marcar baja" : "Reactivar"}
          </button>
          <button disabled={isSaving} onClick={() => removeEmployee(openMenuEmployee.id)} role="menuitem" type="button">
            Eliminar empleado
          </button>
        </div>
      )}
    </div>
  );
}
