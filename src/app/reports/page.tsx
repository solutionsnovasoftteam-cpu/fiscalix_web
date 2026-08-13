import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AutoSubmitForm } from "@/components/AutoSubmitForm";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { getAccessibleCompanyIds, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { isRowInAccessibleCompanyScope } from "@/lib/financialMovements";
import { createTranslator, resultCount } from "@/lib/i18n";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import { loadTaxEstimationReportForUser } from "@/lib/taxEstimation";
import { currentTaxPeriodKey, TAX_REGIME_RULES } from "@/lib/taxEstimation.shared";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";
import {
  defaultUserPreferences,
  formatPreferenceDateTime,
  formatPreferenceMoney,
  formatPreferenceMonth,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

type FinanceRow = {
  empresa_id: string | null;
  fecha: string;
  id: string;
  monto: number | string;
};

const FISCAL_TABLE_PAGE_SIZE = 6;

const REGIME_OPTIONS = TAX_REGIME_RULES.flatMap((rule) => rule.satCodes.map((satCode) => ({
  label: `${satCode} · ${rule.name}`,
  value: satCode,
})));

function number(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMonth(key: string, preferences: UserPreferences) {
  // Use midday UTC so a YYYY-MM period keeps its calendar month in time zones west of UTC.
  const date = new Date(`${key}-01T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? key : formatPreferenceMonth(date, preferences, true);
}

function fiscalStatus(status: "estimated" | "limited" | "review", t: ReturnType<typeof createTranslator>) {
  if (status === "limited") return t("reports.statusLimited");
  if (status === "review") return t("reports.statusReview");
  return t("reports.statusEstimated");
}

function fiscalRowStatus(row: { estimationAvailable: boolean; validationMessages: string[] }) {
  if (!row.estimationAvailable) return "review" as const;
  return row.validationMessages.length ? "limited" as const : "estimated" as const;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const preferences = user.preferences ?? defaultUserPreferences;
  const t = createTranslator(preferences.language);
  const money = (value: number) => formatPreferenceMoney(value, preferences);
  const resolvedSearchParams = await searchParams;
  const query = searchParamText(resolvedSearchParams, "q");
  const requestedCompanyId = searchParamText(resolvedSearchParams, "companyId") || null;
  const requestedPeriod = searchParamText(resolvedSearchParams, "period") || null;
  const requestedRegime = searchParamText(resolvedSearchParams, "regime") || null;
  const requestedStatus = searchParamText(resolvedSearchParams, "status");
  const requestedMovement = searchParamText(resolvedSearchParams, "movement");
  const requestedHistory = searchParamText(resolvedSearchParams, "history");

  const { companyIds, error: scopeError } = await getAccessibleCompanyIds(user);
  const companyIdSet = new Set(companyIds);
  const fiscalReportPromise = loadTaxEstimationReportForUser(user, {
    companyId: requestedCompanyId,
    historyScope: requestedHistory === "all" ? "all" : "period",
    movementFilter: requestedMovement === "considered" || requestedMovement === "excluded" ? requestedMovement : "all",
    period: requestedPeriod,
    regimeSatCode: requestedRegime,
    status: requestedStatus === "estimated" || requestedStatus === "limited" || requestedStatus === "review" ? requestedStatus : "all",
  });

  const [companyIncomeResult, userIncomeResult, companyExpenseResult, userExpenseResult, fiscalReportResult] = await Promise.all([
    companyIds.length
      ? supabase.from("ingresos").select("id,empresa_id,fecha_ingreso,monto").in("empresa_id", companyIds).order("fecha_ingreso", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("ingresos").select("id,empresa_id,usuario_id,fecha_ingreso,monto").eq("usuario_id", user.id).order("fecha_ingreso", { ascending: false }),
    companyIds.length
      ? supabase.from("gastos").select("id,empresa_id,fecha_gasto,monto").in("empresa_id", companyIds).order("fecha_gasto", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("gastos").select("id,empresa_id,usuario_id,fecha_gasto,monto").eq("usuario_id", user.id).order("fecha_gasto", { ascending: false }),
    fiscalReportPromise,
  ]);

  const incomeRows = [
    ...((companyIncomeResult.data ?? []) as Array<{ empresa_id: string | null; fecha_ingreso: string; id: string; monto: number | string }>),
    ...(isMissingColumnError(userIncomeResult.error, "usuario_id")
      ? []
      : ((userIncomeResult.data ?? []) as Array<{ empresa_id: string | null; fecha_ingreso: string; id: string; monto: number | string }>)
          .filter((row) => isRowInAccessibleCompanyScope(row, companyIdSet))),
  ];
  const expenseRows = [
    ...((companyExpenseResult.data ?? []) as Array<{ empresa_id: string | null; fecha_gasto: string; id: string; monto: number | string }>),
    ...(isMissingColumnError(userExpenseResult.error, "usuario_id")
      ? []
      : ((userExpenseResult.data ?? []) as Array<{ empresa_id: string | null; fecha_gasto: string; id: string; monto: number | string }>)
          .filter((row) => isRowInAccessibleCompanyScope(row, companyIdSet))),
  ];
  const incomesById = new Map<string, FinanceRow>();
  const expensesById = new Map<string, FinanceRow>();
  for (const row of incomeRows) incomesById.set(row.id, { empresa_id: row.empresa_id, fecha: row.fecha_ingreso, id: row.id, monto: row.monto });
  for (const row of expenseRows) expensesById.set(row.id, { empresa_id: row.empresa_id, fecha: row.fecha_gasto, id: row.id, monto: row.monto });
  const incomes = [...incomesById.values()];
  const expenses = [...expensesById.values()];
  const totalIncome = incomes.reduce((sum, row) => sum + number(row.monto), 0);
  const totalExpense = expenses.reduce((sum, row) => sum + number(row.monto), 0);
  const periods = new Map<string, { expenses: number; incomes: number; movements: number }>();

  for (const row of incomes) {
    const key = row.fecha.slice(0, 7);
    const period = periods.get(key) ?? { expenses: 0, incomes: 0, movements: 0 };
    period.incomes += number(row.monto);
    period.movements += 1;
    periods.set(key, period);
  }
  for (const row of expenses) {
    const key = row.fecha.slice(0, 7);
    const period = periods.get(key) ?? { expenses: 0, incomes: 0, movements: 0 };
    period.expenses += number(row.monto);
    period.movements += 1;
    periods.set(key, period);
  }

  const rows = [...periods.entries()].sort(([a], [b]) => b.localeCompare(a));
  const filteredRows = rows.filter(([key, period]) => {
    const balance = period.incomes - period.expenses;
    return matchesSearch([
      formatMonth(key, preferences),
      key,
      period.movements,
      money(period.incomes),
      money(period.expenses),
      money(balance),
    ], query);
  });
  const reportsPage = paginateItems(filteredRows, pageFromParam(resolvedSearchParams.page));
  const hasError = scopeError
    || companyIncomeResult.error
    || (!isMissingColumnError(userIncomeResult.error, "usuario_id") && userIncomeResult.error)
    || companyExpenseResult.error
    || (!isMissingColumnError(userExpenseResult.error, "usuario_id") && userExpenseResult.error);
  const fiscalReport = fiscalReportResult.data;
  const fiscalPeriod = fiscalReport?.filters.period ?? requestedPeriod ?? currentTaxPeriodKey();
  const fiscalRows = fiscalReport?.rows ?? [];
  const fiscalHistory = fiscalReport?.history ?? [];
  const fiscalMovements = fiscalReport?.movementTrace ?? [];
  const fiscalCompanies = fiscalReport?.companies ?? [];
  const fiscalResultsPage = paginateItems(fiscalRows, pageFromParam(resolvedSearchParams.fiscalPage), FISCAL_TABLE_PAGE_SIZE);
  const fiscalMovementsPage = paginateItems(fiscalMovements, pageFromParam(resolvedSearchParams.fiscalMovementsPage), FISCAL_TABLE_PAGE_SIZE);
  const fiscalHistoryPage = paginateItems(fiscalHistory, pageFromParam(resolvedSearchParams.fiscalHistoryPage), FISCAL_TABLE_PAGE_SIZE);

  return (
    <AppShell activeHref="/reports" user={user}>
      <main className="reports-content">
        <header className="reports-header">
          <div><p>{t("reports.eyebrow")}</p><h1>{t("reports.title")}</h1><span>{t("reports.description")}</span></div>
        </header>

        {hasError && <section className="dashboard-alert" role="alert"><strong>{t("reports.loadError")}</strong><span>{t("reports.loadErrorHelp")}</span></section>}

        <section className="reports-stats">
          <article><span><Icon name="trending_up" /></span><small>{t("transactions.totalIncome")}</small><strong>{money(totalIncome)}</strong></article>
          <article><span><Icon name="trending_down" /></span><small>{t("transactions.totalExpenses")}</small><strong>{money(totalExpense)}</strong></article>
          <article><span><Icon name="account_balance_wallet" /></span><small>{t("reports.balanceAccumulated")}</small><strong className={totalIncome - totalExpense >= 0 ? "positive" : "negative"}>{money(totalIncome - totalExpense)}</strong></article>
          <article><span><Icon name="calendar_month" /></span><small>{t("reports.periods")}</small><strong>{rows.length}</strong></article>
        </section>

        <section className="reports-card fiscal-report-card">
          <div className="reports-card-heading">
            <div><h2>{t("reports.fiscalTitle")}</h2><p>{t("reports.fiscalHelp")}</p></div>
            <span>{t("dashboard.taxPeriod", { period: formatMonth(fiscalPeriod, preferences) })}</span>
          </div>
          <AutoSubmitForm action="/reports" className="tax-report-filters" method="get">
            <label>
              <span>{t("reports.period")}</span>
              <input defaultValue={fiscalPeriod} name="period" type="month" />
            </label>
            <label>
              <span>{t("taxes.companyFilter")}</span>
              <select defaultValue={fiscalReport?.filters.companyId ?? ""} name="companyId">
                <option value="">{t("reports.allCompanies")}</option>
                {fiscalCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <label>
              <span>{t("reports.regime")}</span>
              <select defaultValue={fiscalReport?.filters.regimeSatCode ?? ""} name="regime">
                <option value="">{t("reports.allRegimes")}</option>
                {REGIME_OPTIONS.map((regime) => <option key={regime.value} value={regime.value}>{regime.label}</option>)}
              </select>
            </label>
            <label>
              <span>{t("reports.status")}</span>
              <select defaultValue={fiscalReport?.filters.status ?? "all"} name="status">
                <option value="all">{t("reports.allStatuses")}</option>
                <option value="estimated">{t("reports.statusEstimated")}</option>
                <option value="limited">{t("reports.statusLimited")}</option>
                <option value="review">{t("reports.statusReview")}</option>
              </select>
            </label>
            <label>
              <span>{t("reports.movementTrace")}</span>
              <select defaultValue={fiscalReport?.filters.movementFilter ?? "all"} name="movement">
                <option value="all">{t("reports.allMovements")}</option>
                <option value="considered">{t("reports.consideredMovements")}</option>
                <option value="excluded">{t("reports.excludedMovements")}</option>
              </select>
            </label>
            <label>
              <span>{t("taxes.historyTitle")}</span>
              <select defaultValue={fiscalReport?.filters.historyScope ?? "period"} name="history">
                <option value="period">{t("reports.currentPeriodHistory")}</option>
                <option value="all">{t("reports.allHistory")}</option>
              </select>
            </label>
            <button className="primary-button compact" type="submit">{t("reports.applyFilters")}</button>
          </AutoSubmitForm>

          {fiscalReportResult.error ? (
            <div className="reports-empty fiscal-report-empty"><span><Icon name="error" /></span><strong>{t("reports.noFiscalResults")}</strong><small>{fiscalReportResult.error}</small></div>
          ) : <div className="fiscal-report-kpis">
            <div><span>{t("taxes.incomeCollected")}</span><strong>{money(fiscalReport?.totals.incomes ?? 0)}</strong></div>
            <div><span>{t("taxes.resicoBase")}</span><strong>{money(fiscalReport?.totals.base ?? 0)}</strong></div>
            <div><span>{t("taxes.estimatedIvaPayable")}</span><strong>{money(fiscalReport?.totals.vatEstimated ?? 0)}</strong></div>
            <div><span>{t("taxes.estimatedTaxTotal")}</span><strong>{money(fiscalReport?.totals.taxEstimated ?? 0)}</strong></div>
          </div>}
        </section>

        {!fiscalReportResult.error && <div className="fiscal-report-table-stack">
          <section className="reports-card fiscal-report-table-card">
            <div className="fiscal-report-section-heading fiscal-report-results-heading"><h2>{t("reports.fiscalResults")}</h2><span>{resultCount(fiscalRows.length, preferences.language)}</span></div>
            {fiscalRows.length ? <>
              <div className="reports-table-scroll"><table className="reports-table fiscal-report-table"><thead><tr><th>{t("taxes.companyFilter")}</th><th>{t("reports.regime")}</th><th>{t("taxes.incomeCollected")}</th><th>{t("taxes.expensesPaid")}</th><th>{t("taxes.resicoBase")}</th><th>{t("taxes.estimatedIvaPayable")}</th><th>{t("taxes.estimatedIsrPayable")}</th><th>{t("taxes.estimatedTaxTotal")}</th><th>{t("reports.status")}</th></tr></thead><tbody>
                {fiscalResultsPage.items.map((row) => {
                  const status = fiscalRowStatus(row);
                  return <tr key={row.companyId}>
                    <td><strong>{row.companyName}</strong><small>{t("taxes.movementCounts", { expenses: row.expenseCount, incomes: row.incomeCount })}</small></td>
                    <td><strong>{row.regimeSatCode || "-"}</strong><small>{row.regimeName}</small></td>
                    <td>{money(row.incomes)}</td><td>{money(row.expenses)}</td><td>{money(row.base)}</td><td>{money(row.vatEstimated ?? 0)}</td><td>{money(row.isrEstimated ?? 0)}</td><td>{money(row.taxEstimated ?? 0)}</td>
                    <td><span className={`fiscal-status fiscal-status-${status}`}>{fiscalStatus(status, t)}</span>{row.validationMessages[0] ? <small>{row.validationMessages[0]}</small> : null}</td>
                  </tr>;
                })}
              </tbody></table></div>
              <TablePagination currentPage={fiscalResultsPage.currentPage} end={fiscalResultsPage.end} hrefForPage={(page) => pageHref("/reports", resolvedSearchParams, "fiscalPage", page)} language={preferences.language} pageSize={FISCAL_TABLE_PAGE_SIZE} start={fiscalResultsPage.start} totalItems={fiscalRows.length} />
            </> : <div className="reports-empty fiscal-report-empty"><span><Icon name="bar_chart" /></span><strong>{t("reports.noFiscalResults")}</strong><small>{t("reports.noFiscalResultsHelp")}</small></div>}
          </section>

          <section className="reports-card fiscal-report-table-card">
            <div className="fiscal-report-section-heading"><h2>{t("reports.movementTrace")}</h2><span>{resultCount(fiscalMovements.length, preferences.language)}</span></div>
            {fiscalMovements.length ? <>
              <div className="reports-table-scroll"><table className="reports-table fiscal-report-table"><thead><tr><th>{t("dashboard.date")}</th><th>{t("dashboard.type")}</th><th>{t("taxes.companyFilter")}</th><th>{t("dashboard.amount")}</th><th>{t("taxes.resicoBase")}</th><th>{t("taxes.estimatedIvaPayable")}</th><th>{t("reports.decision")}</th><th>{t("reports.reason")}</th></tr></thead><tbody>
                {fiscalMovementsPage.items.map((movement) => <tr key={movement.id}>
                  <td>{movement.date}</td><td>{movement.type}</td><td>{fiscalCompanies.find((company) => company.id === movement.companyId)?.name ?? "-"}</td><td>{money(movement.amount)}</td><td>{money(movement.fiscalBase)}</td><td>{money(movement.vatAmount)}</td>
                  <td><span className={`fiscal-status fiscal-status-${movement.considered ? "estimated" : "review"}`}>{movement.considered ? t("reports.consideredMovements") : t("reports.excludedMovements")}</span></td><td>{movement.exclusionReason?.replaceAll("_", " ") ?? "-"}</td>
                </tr>)}
              </tbody></table></div>
              <TablePagination currentPage={fiscalMovementsPage.currentPage} end={fiscalMovementsPage.end} hrefForPage={(page) => pageHref("/reports", resolvedSearchParams, "fiscalMovementsPage", page)} language={preferences.language} pageSize={FISCAL_TABLE_PAGE_SIZE} start={fiscalMovementsPage.start} totalItems={fiscalMovements.length} />
            </> : <div className="reports-empty fiscal-report-empty"><span><Icon name="fact_check" /></span><strong>{t("reports.noFiscalResults")}</strong><small>{t("reports.noFiscalResultsHelp")}</small></div>}
          </section>

          <section className="reports-card fiscal-report-table-card">
            <div className="fiscal-report-section-heading"><h2>{t("reports.fiscalHistory")}</h2><span>{resultCount(fiscalHistory.length, preferences.language)}</span></div>
            {fiscalReportResult.historyError && <p className="fiscal-history-warning">{t("reports.historyUnavailable")}: {fiscalReportResult.historyError}</p>}
            {fiscalHistory.length ? <>
              <div className="reports-table-scroll"><table className="reports-table fiscal-report-table"><thead><tr><th>{t("taxes.execution")}</th><th>{t("reports.period")}</th><th>{t("reports.regime")}</th><th>{t("taxes.incomeCollected")}</th><th>{t("taxes.resicoBase")}</th><th>{t("taxes.estimatedIvaPayable")}</th><th>{t("taxes.estimatedIsrPayable")}</th><th>{t("taxes.estimatedTaxTotal")}</th></tr></thead><tbody>
                {fiscalHistoryPage.items.map((execution) => <tr key={execution.id}>
                  <td><strong>{formatPreferenceDateTime(execution.createdAt, preferences)}</strong></td><td>{execution.periodKey}</td><td><strong>{execution.regimeSatCode ?? "-"}</strong></td><td>{money(execution.income)}</td><td>{money(execution.base)}</td><td>{money(execution.vatEstimated)}</td><td>{money(execution.isrEstimated)}</td><td>{money(execution.taxEstimated)}</td>
                </tr>)}
              </tbody></table></div>
              <TablePagination currentPage={fiscalHistoryPage.currentPage} end={fiscalHistoryPage.end} hrefForPage={(page) => pageHref("/reports", resolvedSearchParams, "fiscalHistoryPage", page)} language={preferences.language} pageSize={FISCAL_TABLE_PAGE_SIZE} start={fiscalHistoryPage.start} totalItems={fiscalHistory.length} />
            </> : <div className="reports-empty fiscal-report-empty"><span><Icon name="history" /></span><strong>{t("taxes.noHistory")}</strong><small>{t("taxes.noHistoryHelp")}</small></div>}
          </section>
        </div>}

        <section className="reports-card">
          <div className="reports-card-heading">
            <div><h2>{t("reports.monthly")}</h2><p>{t("reports.monthlyHelp")}</p></div>
            <div className="table-card-actions">
              <TableSearch label={t("reports.searchLabel")} language={preferences.language} pathname="/reports" placeholder={t("reports.searchPlaceholder")} searchParams={resolvedSearchParams} />
              <span>{resultCount(filteredRows.length, preferences.language)}</span>
            </div>
          </div>
          {filteredRows.length ? (
            <>
              <div className="reports-table-scroll"><table className="reports-table"><thead><tr><th>{t("reports.period")}</th><th>{t("reports.movements")}</th><th>{t("dashboard.income")}</th><th>{t("dashboard.expenses")}</th><th>{t("dashboard.balance")}</th></tr></thead><tbody>
                {reportsPage.items.map(([key, period]) => { const balance = period.incomes - period.expenses; return <tr key={key}><td>{formatMonth(key, preferences)}</td><td>{period.movements}</td><td className="positive">{money(period.incomes)}</td><td className="negative">{money(period.expenses)}</td><td className={balance >= 0 ? "positive" : "negative"}>{money(balance)}</td></tr>; })}
              </tbody></table></div>
              <TablePagination
                currentPage={reportsPage.currentPage}
                end={reportsPage.end}
                hrefForPage={(page) => pageHref("/reports", resolvedSearchParams, "page", page)}
                language={preferences.language}
                start={reportsPage.start}
                totalItems={filteredRows.length}
              />
            </>
          ) : <div className="reports-empty"><span><Icon name="bar_chart" /></span><strong>{query ? t("reports.noSearch") : t("reports.empty")}</strong><small>{query ? t("common.tryAnotherSearch") : t("reports.emptyHelp")}</small></div>}
        </section>
      </main>
    </AppShell>
  );
}
