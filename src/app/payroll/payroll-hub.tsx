"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { getCurrentPayCycle, getQuincenaByOffset, type PayrollRun } from "@/app/payroll/payroll-dates";
import { downloadPayrollPdf } from "@/app/payroll/payroll-pdf";
import { notifyPdfDownload } from "@/lib/clientNotifications";
import { createTranslator } from "@/lib/i18n";
import { paginationRangeLabel } from "@/lib/pagination";
import {
  convertMxnToPreferenceCurrency,
  convertPreferenceCurrencyToMxn,
  formatPreferenceDate,
  formatPreferenceMoney,
  formatPreferenceMonth,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

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
  preferences,
}: {
  databaseStatusMessage?: string;
  initialData?: PayrollHubInitialData;
  preferences: UserPreferences;
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
  const t = createTranslator(preferences.language);

  const payCycle = useMemo(() => getCurrentPayCycle(), []);
  const activeEmployees = employees.filter((employee) => employee.status === "Activo");
  const totalPayroll = activeEmployees.reduce((sum, employee) => sum + employee.salary, 0);
  const perceptions = Math.round(totalPayroll * 1.26);
  const deductions = perceptions - totalPayroll;
  const money = (value: number) => formatPreferenceMoney(value, preferences);
  const date = (value: string) => formatPreferenceDate(value, preferences, value);
  const statusText = (status: PayrollEmployee["status"] | PayrollRun["status"]) => {
    if (status === "Activo") return t("common.active");
    if (status === "Baja") return t("common.inactive");
    if (status === "Pagado") return t("payroll.paid");
    return t("payroll.draft");
  };

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

    if (!payload.run) throw new Error(payload.message || t("payroll.saveRunError"));
    return payload.run;
  }

  async function generatePayroll() {
    if (activeEmployees.length === 0) {
      notify(t("payroll.needEmployeesPayroll"));
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
      notify(t("payroll.runGenerated", { amount: money(run.paid), folio: run.folio }));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("payroll.saveRunError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function createPaymentDraft() {
    if (activeEmployees.length === 0) {
      notify(t("payroll.needEmployeesPayment"));
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
      notify(t("payroll.draftCreated", { folio: run.folio }));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("payroll.createDraftError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function addEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salaryInput = Number(newEmployee.salary);
    if (!newEmployee.name.trim() || !Number.isFinite(salaryInput) || salaryInput <= 0) {
      notify(t("payroll.employeeValidation"));
      return;
    }

    const name = newEmployee.name.trim();
    const salary = convertPreferenceCurrencyToMxn(salaryInput, preferences);
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

      if (!payload.employee) throw new Error(payload.message || t("payroll.saveEmployeeError"));

      setEmployees((current) => [payload.employee!, ...current]);
      setNewEmployee({ name: "", role: "", department: "", salary: "" });
      setShowEmployeeForm(false);
      setPage(1);
      notify(t("payroll.employeeAdded", { name: payload.employee.name }));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("payroll.saveEmployeeError"));
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
      salary: String(Number(convertMxnToPreferenceCurrency(employee.salary, preferences).toFixed(2))),
    });
    setShowEmployeeForm(false);
    closeMenu();
  }

  async function saveEmployeeEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEmployeeId) return;
    const salaryInput = Number(editEmployee.salary);
    if (!editEmployee.name.trim() || !Number.isFinite(salaryInput) || salaryInput <= 0) {
      notify(t("payroll.employeeEditValidation"));
      return;
    }

    const name = editEmployee.name.trim();
    const salary = convertPreferenceCurrencyToMxn(salaryInput, preferences);
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

      if (!payload.employee) throw new Error(payload.message || t("payroll.updateEmployeeError"));

      setEmployees((current) => current.map((employee) => employee.id === editingEmployeeId ? payload.employee! : employee));
      setEditingEmployeeId(null);
      setEditEmployee({ name: "", role: "", department: "", salary: "" });
      notify(t("payroll.employeeUpdated", { name: payload.employee.name }));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("payroll.updateEmployeeError"));
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
      notify(employee ? t("payroll.employeeDeletedNamed", { name: employee.name }) : t("payroll.employeeDeleted"));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("payroll.deleteEmployeeError"));
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

      if (!payload.employee) throw new Error(payload.message || t("payroll.statusUpdateError"));

      setEmployees((current) => current.map((item) => item.id === id ? payload.employee! : item));
      closeMenu();
      notify(t("payroll.statusUpdated"));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("payroll.statusUpdateError"));
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
    setIsSaving(true);
    try {
      const payload = await requestJson<PayrollRunResponse>(`/api/payroll/runs/${id}`, {
        body: JSON.stringify({ status: "Pagado" }),
        method: "PATCH",
      });
      if (!payload.run) throw new Error(payload.message || t("payroll.processDraftError"));
      setHistory((current) => current.map((item) => (item.id === id ? payload.run! : item)));
      notify(t("payroll.processedDraft", { folio: payload.run.folio }));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("payroll.processDraftError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadRun(id: string) {
    const run = history.find((item) => item.id === id);
    if (!run) {
      notify(t("payroll.downloadMissing"));
      return;
    }

    try {
      await downloadPayrollPdf(run, preferences);
      await notifyPdfDownload("payroll", { folio: run.folio, recordCount: run.employees });
      await requestJson<PayrollRunResponse>(`/api/payroll/runs/${id}`, {
        body: JSON.stringify({ downloaded: true }),
        method: "PATCH",
      });
      setHistory((current) =>
        current.map((item) => (item.id === id ? { ...item, downloaded: true } : item)),
      );
      notify(t("payroll.downloaded", { folio: run.folio }));
    } catch {
      notify(t("payroll.downloadError"));
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
          <p className="payroll-eyebrow">{t("payroll.eyebrow", { period: formatPreferenceMonth(new Date(), preferences, true) })}</p>
          <h1>{t("payroll.title")}</h1>
          <span>{t("payroll.description")}</span>
        </div>
        <div className="payroll-header-actions">
          <label className="payroll-search">
            <Icon name="search" />
            <input
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("payroll.searchPlaceholder")}
              type="search"
              value={query}
            />
          </label>
          <button className="payroll-btn payroll-btn-primary" disabled={isSaving || isDatabaseBlocked} onClick={createPaymentDraft} type="button">
            <Icon name="add" />
            {t("payroll.newPayment")}
          </button>
        </div>
      </header>

      <section className="payroll-kpis" aria-label={t("fiscalCenter.indicators")}>
        <article>
          <small>{t("payroll.totalEmployees")}</small>
          <strong>{activeEmployees.length}</strong>
          <span className="payroll-kpi-caption">{t("payroll.active")}</span>
          <span className="payroll-kpi-icon">
            <Icon name="person" />
          </span>
        </article>
        <article className="is-accent">
          <small>{t("payroll.totalToPay")}</small>
          <strong>{money(totalPayroll)}</strong>
          <span className="payroll-kpi-caption">{t("payroll.currentPeriod")}</span>
          <span className="payroll-kpi-icon">
            <Icon name="payments" />
          </span>
        </article>
        <article>
          <small>{t("payroll.processed")}</small>
          <strong>{history.filter((run) => run.status === "Pagado").length}</strong>
          <span className="payroll-kpi-caption">{t("payroll.registered")}</span>
          <span className="payroll-kpi-icon">
            <Icon name="fact_check" />
          </span>
        </article>
        <article>
          <small>{t("payroll.nextPayment")}</small>
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
              <h2>{t("payroll.employees")}</h2>
              <p>{paginationRangeLabel(filtered.length, pageStart, pageEnd, preferences.language)} {t("payroll.staff")} · {t("payroll.page")} {currentPage} {t("payroll.of")} {totalPages}</p>
            </div>
            <button className="payroll-btn payroll-btn-secondary" disabled={isSaving || isDatabaseBlocked} onClick={() => { setShowEmployeeForm((open) => !open); setEditingEmployeeId(null); }} type="button">
              <Icon name="add" />
              {showEmployeeForm ? t("button.cancel") : t("payroll.newEmployee")}
            </button>
          </div>

          {editingEmployeeId && (
            <form className="payroll-form" onSubmit={saveEmployeeEdit}>
              <input onChange={(event) => setEditEmployee((value) => ({ ...value, name: event.target.value }))} placeholder={t("payroll.fullName")} required value={editEmployee.name} />
              <input onChange={(event) => setEditEmployee((value) => ({ ...value, role: event.target.value }))} placeholder={t("payroll.position")} value={editEmployee.role} />
              <input onChange={(event) => setEditEmployee((value) => ({ ...value, department: event.target.value }))} placeholder={t("payroll.department")} value={editEmployee.department} />
              <input min="1" onChange={(event) => setEditEmployee((value) => ({ ...value, salary: event.target.value }))} placeholder={t("payroll.grossSalary", { currency: preferences.currency })} required step="0.01" type="number" value={editEmployee.salary} />
              <button className="payroll-btn payroll-btn-primary" disabled={isSaving} type="submit">{t("button.saveChanges")}</button>
              <button className="payroll-btn payroll-btn-secondary" disabled={isSaving} onClick={() => setEditingEmployeeId(null)} type="button">{t("payroll.cancelEdit")}</button>
            </form>
          )}

          {showEmployeeForm && (
            <form className="payroll-form" onSubmit={addEmployee}>
              <input onChange={(event) => setNewEmployee((value) => ({ ...value, name: event.target.value }))} placeholder={t("payroll.fullName")} required value={newEmployee.name} />
              <input onChange={(event) => setNewEmployee((value) => ({ ...value, role: event.target.value }))} placeholder={t("payroll.position")} value={newEmployee.role} />
              <input onChange={(event) => setNewEmployee((value) => ({ ...value, department: event.target.value }))} placeholder={t("payroll.department")} value={newEmployee.department} />
              <input min="1" onChange={(event) => setNewEmployee((value) => ({ ...value, salary: event.target.value }))} placeholder={t("payroll.grossSalary", { currency: preferences.currency })} required step="0.01" type="number" value={newEmployee.salary} />
              <button className="payroll-btn payroll-btn-primary" disabled={isSaving} type="submit">{t("payroll.saveEmployee")}</button>
            </form>
          )}

          <div className="payroll-table-wrap">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>{t("payroll.employee")}</th>
                  <th>{t("payroll.position")}</th>
                  <th>{t("payroll.department")}</th>
                  <th>{t("payroll.salary")}</th>
                  <th>{t("payroll.status")}</th>
                  <th aria-label={t("table.actions")} />
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
                      <td>{money(employee.salary)}</td>
                      <td><span className={`payroll-status ${employee.status === "Activo" ? "active" : "inactive"}`}>{statusText(employee.status)}</span></td>
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
                        <strong>{t("payroll.noEmployees")}</strong>
                        <small>{t("payroll.addEmployeesHelp")}</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className="payroll-pages" aria-label={t("pagination.label")}>
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
          <h2>{t("payroll.nextPaymentPanel")}</h2>
          <p className="payroll-slip-total">{money(totalPayroll)}</p>
          <ul className="payroll-slip-lines">
            <li><span>{t("payroll.payDate")}</span><strong>{payCycle.shortPayDay} {payCycle.shortPayYear}</strong></li>
            <li><span>{t("payroll.period")}</span><strong>{payCycle.period}</strong></li>
            <li><span>{t("payroll.employees")}</span><strong>{activeEmployees.length}</strong></li>
            <li><span>{t("payroll.perceptions")}</span><strong>{money(perceptions)}</strong></li>
            <li><span>{t("payroll.deductions")}</span><strong>{money(deductions)}</strong></li>
          </ul>
          <button className="payroll-btn payroll-btn-primary payroll-btn-block" disabled={isSaving || isDatabaseBlocked} onClick={generatePayroll} type="button">
            <Icon name="payments" />
            {t("payroll.generate")}
          </button>
        </aside>
      </div>

      <section className="payroll-panel payroll-history">
        <div className="payroll-panel-head">
          <div>
            <h2>{t("payroll.history")}</h2>
            <p>{history.length} {history.length === 1 ? t("income.record") : t("income.records")}</p>
          </div>
          {history.length > 4 ? (
            <button className="payroll-btn payroll-btn-secondary" onClick={() => setShowAllHistory((value) => !value)} type="button">
              {showAllHistory ? t("payroll.showLess") : t("payroll.showAll")}
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
                  <span className={`payroll-status ${run.status === "Pagado" ? "active" : "pending"}`}>{statusText(run.status)}</span>
                </header>
                <p>{run.period}</p>
                <small>{t("payroll.payment")} · {date(run.payDate)}</small>
                <div className="payroll-history-meta">
                  <span>{run.employees} {t("payroll.employees").toLowerCase()}</span>
                  <em>{money(run.paid)}</em>
                </div>
                {run.status === "Borrador" && (
                  <button className="payroll-btn payroll-btn-primary" disabled={isSaving} onClick={() => processDraft(run.id)} type="button">
                    <Icon name="payments" />
                    {t("payroll.processDraft")}
                  </button>
                )}
                <button
                  className={`payroll-btn payroll-btn-secondary ${run.downloaded ? "is-done" : ""}`}
                  disabled={isSaving}
                  onClick={() => downloadRun(run.id)}
                  type="button"
                >
                  <Icon name="south" />
                  {run.downloaded ? t("payroll.downloadedPdf") : t("button.downloadPdf")}
                </button>
              </article>
            ))
          ) : (
            <div className="payroll-empty payroll-history-empty">
              <span><Icon name="history" /></span>
              <strong>{t("payroll.noRuns")}</strong>
              <small>{t("payroll.noRunsHelp")}</small>
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
            {t("payroll.editEmployee")}
          </button>
          <button disabled={isSaving} onClick={() => toggleEmployeeStatus(openMenuEmployee.id)} role="menuitem" type="button">
            {openMenuEmployee.status === "Activo" ? t("payroll.deactivate") : t("payroll.reactivate")}
          </button>
          <button disabled={isSaving} onClick={() => removeEmployee(openMenuEmployee.id)} role="menuitem" type="button">
            {t("payroll.deleteEmployee")}
          </button>
        </div>
      )}
    </div>
  );
}
