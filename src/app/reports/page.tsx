import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { getAccessibleCompanyIds, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { isRowInAccessibleCompanyScope } from "@/lib/financialMovements";
import { createTranslator, resultCount } from "@/lib/i18n";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";
import {
  defaultUserPreferences,
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

function number(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMonth(key: string, preferences: UserPreferences) {
  const date = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? key : formatPreferenceMonth(date, preferences, true);
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

  const { companyIds, error: scopeError } = await getAccessibleCompanyIds(user);
  const companyIdSet = new Set(companyIds);

  const [companyIncomeResult, userIncomeResult, companyExpenseResult, userExpenseResult] = await Promise.all([
    companyIds.length
      ? supabase.from("ingresos").select("id,empresa_id,fecha_ingreso,monto").in("empresa_id", companyIds).order("fecha_ingreso", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("ingresos").select("id,empresa_id,usuario_id,fecha_ingreso,monto").eq("usuario_id", user.id).order("fecha_ingreso", { ascending: false }),
    companyIds.length
      ? supabase.from("gastos").select("id,empresa_id,fecha_gasto,monto").in("empresa_id", companyIds).order("fecha_gasto", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("gastos").select("id,empresa_id,usuario_id,fecha_gasto,monto").eq("usuario_id", user.id).order("fecha_gasto", { ascending: false }),
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
