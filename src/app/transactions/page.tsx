import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { getAccessibleCompanies, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { isRowInAccessibleCompanyScope } from "@/lib/financialMovements";
import { createTranslator, resultCount } from "@/lib/i18n";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";
import {
  defaultUserPreferences,
  formatPreferenceDate,
  formatPreferenceMoney,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

type Relation<T> = T | T[] | null;

type FinanceRow = {
  categorias_financieras: Relation<{ nombre: string | null }>;
  concepto: string | null;
  empresa_id: string | null;
  empresas: Relation<{ nombre_comercial: string | null }>;
  fecha: string | null;
  id: string;
  monto: number | string | null;
};

type Movement = {
  amount: number;
  category: string;
  company: string;
  concept: string;
  date: string;
  id: string;
  type: "Gasto" | "Ingreso";
};

function firstRelation<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string, preferences: UserPreferences) {
  return formatPreferenceDate(value, preferences, value);
}

export default async function TransactionsPage({
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

  const { companies, error: companiesError } = await getAccessibleCompanies(user);

  const companyIds = [...new Set(companies.map((company) => company.id))];
  const companyIdSet = new Set(companyIds);
  const companyNameById = new Map(companies.map((company) => [company.id, company.nombre_comercial || t("common.noCompany")]));

  const [companyIncomeResult, userIncomeResult, companyExpenseResult, userExpenseResult] = await Promise.all([
    companyIds.length
      ? supabase
          .from("ingresos")
          .select("id,concepto,monto,fecha_ingreso,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
          .in("empresa_id", companyIds)
          .order("fecha_ingreso", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as FinanceRow[], error: null }),
    supabase
      .from("ingresos")
      .select("id,concepto,monto,usuario_id,fecha_ingreso,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
      .eq("usuario_id", user.id)
      .order("fecha_ingreso", { ascending: false })
      .limit(100),
    companyIds.length
      ? supabase
          .from("gastos")
          .select("id,concepto,monto,fecha_gasto,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
          .in("empresa_id", companyIds)
          .order("fecha_gasto", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as FinanceRow[], error: null }),
    supabase
      .from("gastos")
      .select("id,concepto,monto,usuario_id,fecha_gasto,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
      .eq("usuario_id", user.id)
      .order("fecha_gasto", { ascending: false })
      .limit(100),
  ]);

  const incomesById = new Map<string, FinanceRow>();
  const expensesById = new Map<string, FinanceRow>();
  for (const income of [
    ...((companyIncomeResult.data ?? []) as Array<Omit<FinanceRow, "fecha"> & { fecha_ingreso: string | null }>),
    ...(isMissingColumnError(userIncomeResult.error, "usuario_id")
      ? []
      : ((userIncomeResult.data ?? []) as Array<Omit<FinanceRow, "fecha"> & { fecha_ingreso: string | null }>)
        .filter((row) => isRowInAccessibleCompanyScope(row, companyIdSet))),
  ]) {
    incomesById.set(income.id, { ...income, fecha: income.fecha_ingreso });
  }
  for (const expense of [
    ...((companyExpenseResult.data ?? []) as Array<Omit<FinanceRow, "fecha"> & { fecha_gasto: string | null }>),
    ...(isMissingColumnError(userExpenseResult.error, "usuario_id")
      ? []
      : ((userExpenseResult.data ?? []) as Array<Omit<FinanceRow, "fecha"> & { fecha_gasto: string | null }>)
        .filter((row) => isRowInAccessibleCompanyScope(row, companyIdSet))),
  ]) {
    expensesById.set(expense.id, { ...expense, fecha: expense.fecha_gasto });
  }
  const incomes = [...incomesById.values()];
  const expenses = [...expensesById.values()];

  function toMovement(row: FinanceRow, type: Movement["type"]): Movement {
    return {
      amount: asNumber(row.monto),
      category: firstRelation(row.categorias_financieras)?.nombre || t("common.noCategory"),
      company: firstRelation(row.empresas)?.nombre_comercial || companyNameById.get(row.empresa_id ?? "") || t("common.noCompany"),
      concept: row.concepto || (type === "Ingreso" ? t("dashboard.incomeNoDescription") : t("dashboard.expenseNoDescription")),
      date: row.fecha || "",
      id: `${type.toLowerCase()}-${row.id}`,
      type,
    };
  }

  const movements = [
    ...incomes.map((income) => toMovement(income, "Ingreso")),
    ...expenses.map((expense) => toMovement(expense, "Gasto")),
  ].filter((movement) => movement.date).sort((a, b) => b.date.localeCompare(a.date));

  const totalIncome = movements.filter((movement) => movement.type === "Ingreso").reduce((sum, movement) => sum + movement.amount, 0);
  const totalExpense = movements.filter((movement) => movement.type === "Gasto").reduce((sum, movement) => sum + movement.amount, 0);
  const filteredMovements = movements.filter((movement) => matchesSearch([
    formatDate(movement.date, preferences),
    movement.date,
    movement.concept,
    movement.company,
    movement.category,
    movement.type,
    movement.amount,
    money(movement.amount),
  ], query));
  const movementsPage = paginateItems(filteredMovements, pageFromParam(resolvedSearchParams.page));
  const hasError = companiesError
    || companyIncomeResult.error
    || (!isMissingColumnError(userIncomeResult.error, "usuario_id") && userIncomeResult.error)
    || companyExpenseResult.error
    || (!isMissingColumnError(userExpenseResult.error, "usuario_id") && userExpenseResult.error);

  return (
    <AppShell activeHref="/transactions" user={user}>
      <main className="reports-content">
        <header className="reports-header">
          <p>{t("transactions.eyebrow")}</p>
          <h1>{t("transactions.title")}</h1>
          <span>{t("transactions.description")}</span>
        </header>

        {hasError && (
          <section className="dashboard-alert" role="alert">
            <strong>{t("transactions.loadError")}</strong>
            <span>{t("transactions.loadErrorHelp")}</span>
          </section>
        )}

        <section className="reports-stats">
          <article><span><Icon name="receipt_long" /></span><small>{t("transactions.total")}</small><strong>{movements.length}</strong></article>
          <article><span><Icon name="trending_up" /></span><small>{t("transactions.totalIncome")}</small><strong className="positive">{money(totalIncome)}</strong></article>
          <article><span><Icon name="trending_down" /></span><small>{t("transactions.totalExpenses")}</small><strong className="negative">{money(totalExpense)}</strong></article>
          <article><span><Icon name="account_balance_wallet" /></span><small>{t("transactions.balance")}</small><strong className={totalIncome - totalExpense >= 0 ? "positive" : "negative"}>{money(totalIncome - totalExpense)}</strong></article>
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div><h2>{t("transactions.all")}</h2><p>{t("transactions.allHelp")}</p></div>
            <div className="table-card-actions">
              <TableSearch label={t("transactions.searchLabel")} language={preferences.language} pathname="/transactions" placeholder={t("transactions.searchPlaceholder")} searchParams={resolvedSearchParams} />
              <span>{resultCount(filteredMovements.length, preferences.language)}</span>
            </div>
          </div>

          {filteredMovements.length ? (
            <>
              <div className="reports-table-scroll">
                <table className="reports-table">
                  <thead><tr><th>{t("table.date")}</th><th>{t("transactions.title")}</th><th>{t("table.company")}</th><th>{t("table.category")}</th><th>{t("table.type")}</th><th>{t("table.amount")}</th></tr></thead>
                  <tbody>
                    {movementsPage.items.map((movement) => (
                      <tr key={movement.id}>
                        <td>{formatDate(movement.date, preferences)}</td>
                        <td>{movement.concept}</td>
                        <td>{movement.company}</td>
                        <td>{movement.category}</td>
                        <td><span className={movement.type === "Ingreso" ? "admin-status" : "admin-status suspended"}>{movement.type === "Ingreso" ? t("dashboard.income") : t("dashboard.expenses")}</span></td>
                        <td className={movement.type === "Ingreso" ? "positive" : "negative"}>{movement.type === "Ingreso" ? "+" : "−"}{money(movement.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={movementsPage.currentPage}
                end={movementsPage.end}
                hrefForPage={(page) => pageHref("/transactions", resolvedSearchParams, "page", page)}
                language={preferences.language}
                start={movementsPage.start}
                totalItems={filteredMovements.length}
              />
            </>
          ) : (
            <div className="reports-empty">
              <span><Icon name="sync_alt" /></span>
              <strong>{query ? t("transactions.noSearch") : t("transactions.empty")}</strong>
              <small>{query ? t("common.tryAnotherSearch") : t("transactions.emptyHelp")}</small>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
