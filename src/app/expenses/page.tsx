import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { ExpenseActions } from "@/app/expenses/expense-actions";
import { getAccessibleCompanies, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
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

type ExpenseRow = {
  id: string;
  concepto: string;
  monto: number | string;
  usuario_id?: string | null;
  fecha_gasto: string;
  empresa_id: string | null;
  categoria_id: string | null;
  empresas: { nombre_comercial: string | null } | { nombre_comercial: string | null }[] | null;
  categorias_financieras: { nombre: string | null; tipo: string | null } | { nombre: string | null; tipo: string | null }[] | null;
};

type CategoryRow = {
  id: string;
  nombre: string | null;
  tipo: string | null;
};

function asNumber(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string, preferences: UserPreferences) {
  return formatPreferenceDate(value, preferences, value);
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function categoryLabel(expense: ExpenseRow, fallbackText = "Sin categoría") {
  return firstRelation(expense.categorias_financieras)?.nombre || fallbackText;
}

function splitCustomCompanyConcept(value: string | null | undefined) {
  const cleanValue = value?.trim() ?? "";
  const [companyName, ...descriptionParts] = cleanValue.split(" · ");
  if (!descriptionParts.length) return { companyName: "", description: cleanValue };

  const description = descriptionParts.join(" · ").trim();
  return {
    companyName: companyName.trim(),
    description: description || cleanValue,
  };
}

function companyLabel(expense: ExpenseRow, fallbackText = "Independiente") {
  const registeredCompany = firstRelation(expense.empresas)?.nombre_comercial;
  if (registeredCompany) return registeredCompany;

  return splitCustomCompanyConcept(expense.concepto).companyName || fallbackText;
}

function expenseDescription(expense: ExpenseRow, fallbackText = "Sin registrar") {
  if (firstRelation(expense.empresas)?.nombre_comercial) return fallback(expense.concepto, fallbackText);
  return fallback(splitCustomCompanyConcept(expense.concepto).description, fallbackText);
}

function fallback(value: string | null | undefined, fallbackText = "Sin registrar") {
  return value?.trim() || fallbackText;
}

function isExpenseCategory(category: CategoryRow) {
  const normalized = category.tipo?.trim().toLowerCase();
  return !normalized || ["gasto", "gastos", "egreso", "egresos", "expense", "expenses"].includes(normalized);
}

export default async function ExpensesPage({
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
  const companyIds = companies.map((company) => company.id);

  const [companyExpensesResult, userExpensesResult, categoriesResult] = await Promise.all([
    companyIds.length
      ? supabase
          .from("gastos")
          .select("id,concepto,monto,fecha_gasto,empresa_id,categoria_id,empresas(nombre_comercial),categorias_financieras(nombre,tipo)")
          .in("empresa_id", companyIds)
          .order("fecha_gasto", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as ExpenseRow[], error: null }),
    supabase
      .from("gastos")
      .select("id,concepto,monto,usuario_id,fecha_gasto,empresa_id,categoria_id,empresas(nombre_comercial),categorias_financieras(nombre,tipo)")
      .eq("usuario_id", user.id)
      .order("fecha_gasto", { ascending: false })
      .limit(50),
    supabase.from("categorias_financieras").select("id,nombre,tipo").order("nombre", { ascending: true }),
  ]);

  const userExpenses = isMissingColumnError(userExpensesResult.error, "usuario_id") ? [] : (userExpensesResult.data ?? []) as ExpenseRow[];
  const expensesById = new Map<string, ExpenseRow>();
  for (const expense of [...((companyExpensesResult.data ?? []) as ExpenseRow[]), ...userExpenses]) {
    expensesById.set(expense.id, expense);
  }
  const expenses = Array.from(expensesById.values()).sort((a, b) => String(b.fecha_gasto ?? "").localeCompare(String(a.fecha_gasto ?? ""))).slice(0, 50);
  const expenseCategories = ((categoriesResult.data ?? []) as CategoryRow[]).filter(isExpenseCategory);
  const total = expenses.reduce((sum, expense) => sum + asNumber(expense.monto), 0);
  const average = expenses.length ? total / expenses.length : 0;
  const highest = expenses.reduce((max, expense) => Math.max(max, asNumber(expense.monto)), 0);
  const usedCategories = new Set(expenses.map((expense) => expense.categoria_id || categoryLabel(expense, t("common.noCategory")))).size;
  const filteredExpenses = expenses.filter((expense) => matchesSearch([
    formatDate(expense.fecha_gasto, preferences),
    expense.fecha_gasto,
    companyLabel(expense, t("common.independent")),
    expenseDescription(expense, t("common.notRegistered")),
    categoryLabel(expense, t("common.noCategory")),
    asNumber(expense.monto),
    money(asNumber(expense.monto)),
  ], query));
  const expensesPage = paginateItems(filteredExpenses, pageFromParam(resolvedSearchParams.page));

  return (
    <AppShell activeHref="/expenses" user={user}>
      <main className="expenses-content">
        <header className="expenses-header">
          <div>
            <p>{t("expenses.eyebrow")}</p>
            <h1>{t("expenses.title")}</h1>
            <span>{t("expenses.description")}</span>
          </div>
          <ExpenseActions
            categories={expenseCategories.map((category) => ({ id: category.id, nombre: fallback(category.nombre, t("common.notRegistered")) }))}
            companies={companies.map((company) => ({ id: company.id, nombre: fallback(company.nombre_comercial, t("common.notRegistered")) }))}
            rows={expenses.map((expense) => ({
              categoria: categoryLabel(expense, t("common.noCategory")),
              concepto: expenseDescription(expense, t("common.notRegistered")),
              empresa: companyLabel(expense, t("common.independent")),
              fecha_gasto: expense.fecha_gasto,
              id: expense.id,
              monto: asNumber(expense.monto),
            }))}
            preferences={preferences}
          />
        </header>

        {(companiesError || companyExpensesResult.error || (!isMissingColumnError(userExpensesResult.error, "usuario_id") && userExpensesResult.error) || categoriesResult.error) && (
          <section className="expenses-alert" role="alert">
            <strong>{t("expenses.loadError")}</strong>
            <span>{t("expenses.loadErrorHelp")}</span>
          </section>
        )}

        <section className="expenses-table-card">
          <div className="receipts-card-top">
            <TableSearch
              label={t("expenses.searchLabel")}
              language={preferences.language}
              pathname="/expenses"
              placeholder={t("expenses.searchPlaceholder")}
              searchParams={resolvedSearchParams}
            />
            <span className="receipts-count">{resultCount(filteredExpenses.length, preferences.language)}</span>
          </div>
          <div className="expenses-table-scroll">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>{t("table.date")}</th>
                  <th>{t("table.company")}</th>
                  <th>{t("table.description")}</th>
                  <th>{t("table.amount")}</th>
                  <th>{t("table.category")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length ? (
                  expensesPage.items.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.fecha_gasto, preferences)}</td>
                      <td>{companyLabel(expense, t("common.independent"))}</td>
                      <td>{expenseDescription(expense, t("common.notRegistered"))}</td>
                      <td>{money(asNumber(expense.monto))}</td>
                      <td><span className="expense-category"><Icon name="category" /> {categoryLabel(expense, t("common.noCategory"))}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="expenses-empty">
                        <span><Icon name="trending_down" /></span>
                        <strong>{query ? t("expenses.noSearch") : t("expenses.empty")}</strong>
                        <small>{query ? t("common.tryAnotherSearch") : t("expenses.emptyHelp")}</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={expensesPage.currentPage}
            end={expensesPage.end}
            hrefForPage={(page) => pageHref("/expenses", resolvedSearchParams, "page", page)}
            language={preferences.language}
            start={expensesPage.start}
            totalItems={filteredExpenses.length}
          />
        </section>

        <section className="expenses-stat-grid">
          <article>
            <span><Icon name="trending_down" /></span>
            <div>
              <small>{t("expenses.total")}</small>
              <strong>{money(total)}</strong>
              <p>{expenses.length} {t(expenses.length === 1 ? "income.record" : "income.records")}</p>
            </div>
          </article>
          <article>
            <span><Icon name="calculate" /></span>
            <div>
              <small>{t("expenses.average")}</small>
              <strong>{money(average)}</strong>
              <p>{t("expenses.calculated")}</p>
            </div>
          </article>
          <article>
            <span><Icon name="south" /></span>
            <div>
              <small>{t("expenses.highest")}</small>
              <strong>{money(highest)}</strong>
              <p>{highest ? t("expenses.highestHelp") : t("expenses.noRecords")}</p>
            </div>
          </article>
          <article>
            <span><Icon name="category" /></span>
            <div>
              <small>{t("expenses.categories")}</small>
              <strong>{usedCategories}</strong>
              <p>{expenses.length ? t("expenses.usedCategories") : t("expenses.noCategories")}</p>
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
