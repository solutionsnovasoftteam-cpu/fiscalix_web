import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { IncomeActions } from "@/app/income/income-actions";
import { getAccessibleCompanies, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";
import {
  defaultUserPreferences,
  formatPreferenceDate,
  formatPreferenceMoney,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

type IncomeRow = {
  id: string;
  concepto: string;
  monto: number | string;
  usuario_id?: string | null;
  fecha_ingreso: string;
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

function categoryLabel(income: IncomeRow, fallbackText = "Sin categoría") {
  return firstRelation(income.categorias_financieras)?.nombre || fallbackText;
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

function companyLabel(income: IncomeRow, fallbackText = "Independiente") {
  const registeredCompany = firstRelation(income.empresas)?.nombre_comercial;
  if (registeredCompany) return registeredCompany;

  return splitCustomCompanyConcept(income.concepto).companyName || fallbackText;
}

function incomeDescription(income: IncomeRow, fallbackText = "Sin registrar") {
  if (firstRelation(income.empresas)?.nombre_comercial) return fallback(income.concepto, fallbackText);
  return fallback(splitCustomCompanyConcept(income.concepto).description, fallbackText);
}

function fallback(value: string | null | undefined, fallbackText = "Sin registrar") {
  return value?.trim() || fallbackText;
}

function isIncomeCategory(category: CategoryRow) {
  const normalized = category.tipo?.trim().toLowerCase();
  return !normalized || ["ingreso", "ingresos", "income", "incomes", "revenue", "venta", "ventas"].includes(normalized);
}

export default async function IncomePage({
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

  const [companyIncomeResult, userIncomeResult, categoriesResult] = await Promise.all([
    companyIds.length
      ? supabase
          .from("ingresos")
          .select("id,concepto,monto,fecha_ingreso,empresa_id,categoria_id,empresas(nombre_comercial),categorias_financieras(nombre,tipo)")
          .in("empresa_id", companyIds)
          .order("fecha_ingreso", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as IncomeRow[], error: null }),
    supabase
      .from("ingresos")
      .select("id,concepto,monto,usuario_id,fecha_ingreso,empresa_id,categoria_id,empresas(nombre_comercial),categorias_financieras(nombre,tipo)")
      .eq("usuario_id", user.id)
      .order("fecha_ingreso", { ascending: false })
      .limit(50),
    supabase.from("categorias_financieras").select("id,nombre,tipo").order("nombre", { ascending: true }),
  ]);

  const userIncomes = isMissingColumnError(userIncomeResult.error, "usuario_id") ? [] : (userIncomeResult.data ?? []) as IncomeRow[];
  const incomesById = new Map<string, IncomeRow>();
  for (const income of [...((companyIncomeResult.data ?? []) as IncomeRow[]), ...userIncomes]) {
    incomesById.set(income.id, income);
  }
  const incomes = Array.from(incomesById.values()).sort((a, b) => String(b.fecha_ingreso ?? "").localeCompare(String(a.fecha_ingreso ?? ""))).slice(0, 50);
  const incomeCategories = ((categoriesResult.data ?? []) as CategoryRow[]).filter(isIncomeCategory);
  const total = incomes.reduce((sum, income) => sum + asNumber(income.monto), 0);
  const average = incomes.length ? total / incomes.length : 0;
  const categories = new Set(incomes.map((income) => income.categoria_id).filter(Boolean)).size;
  const uncategorized = incomes.filter((income) => !income.categoria_id).length;
  const filteredIncomes = incomes.filter((income) => matchesSearch([
    formatDate(income.fecha_ingreso, preferences),
    income.fecha_ingreso,
    companyLabel(income, t("common.independent")),
    incomeDescription(income, t("common.notRegistered")),
    categoryLabel(income, t("common.noCategory")),
    asNumber(income.monto),
    money(asNumber(income.monto)),
  ], query));
  const incomePage = paginateItems(filteredIncomes, pageFromParam(resolvedSearchParams.page));

  return (
    <AppShell activeHref="/income" user={user}>
      <main className="income-content">
        <header className="income-header">
          <div>
            <h1>{t("income.title")}</h1>
            <span>{t("income.description")}</span>
          </div>
          <IncomeActions
            categories={incomeCategories.map((category) => ({ id: category.id, nombre: fallback(category.nombre, t("common.notRegistered")) }))}
            companies={companies.map((company) => ({ id: company.id, nombre: fallback(company.nombre_comercial, t("common.notRegistered")) }))}
            rows={incomes.map((income) => ({
              categoria: categoryLabel(income, t("common.noCategory")),
              concepto: incomeDescription(income, t("common.notRegistered")),
              empresa: companyLabel(income, t("common.independent")),
              fecha_ingreso: income.fecha_ingreso,
              id: income.id,
              monto: asNumber(income.monto),
            }))}
            preferences={preferences}
          />
        </header>

        {(companiesError || companyIncomeResult.error || (!isMissingColumnError(userIncomeResult.error, "usuario_id") && userIncomeResult.error) || categoriesResult.error) && (
          <section className="income-alert" role="alert">
            <strong>{t("income.loadError")}</strong>
            <span>{t("income.loadErrorHelp")}</span>
          </section>
        )}

        <section className="income-stat-grid">
          <article>
            <span><Icon name="attach_money" /></span>
            <div>
              <small>{t("income.totalMoney")}</small>
              <strong>{money(total)}</strong>
              <p>{t("income.calculated")}</p>
            </div>
          </article>
          <article>
            <span><Icon name="receipt_long" /></span>
            <div>
              <small>{t("income.totalCount")}</small>
              <strong>{incomes.length}</strong>
              <p>{t(incomes.length === 1 ? "income.record" : "income.records")}</p>
            </div>
          </article>
          <article>
            <span><Icon name="calculate" /></span>
            <div>
              <small>{t("income.average")}</small>
              <strong>{money(average)}</strong>
              <p>{incomes.length ? t("income.realAverage") : t("income.noRecords")}</p>
            </div>
          </article>
          <article>
            <span><Icon name="category" /></span>
            <div>
              <small>{t("income.categories")}</small>
              <strong>{categories}</strong>
              <p>{uncategorized ? t("income.uncategorized", { count: uncategorized }) : t("income.noCategoryPending")}</p>
            </div>
          </article>
        </section>

        <section className="income-table-card">
          <div className="income-toolbar">
            <div className="income-tabs" aria-label="Filtros de ingresos">
              <button className="active" type="button">{t("income.all")}</button>
              <button type="button">{t("income.categorized")}</button>
              <button type="button">{t("income.uncategorizedTab")}</button>
            </div>
            <div className="income-tools">
              <TableSearch
                label={t("income.searchLabel")}
                language={preferences.language}
                pathname="/income"
                placeholder={t("income.searchPlaceholder")}
                searchParams={resolvedSearchParams}
              />
              <button type="button"><Icon name="filter_list" /> {t("button.filter")}</button>
            </div>
          </div>

          <div className="income-table-scroll">
            <table className="income-table">
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
                {filteredIncomes.length ? (
                  incomePage.items.map((income) => (
                    <tr key={income.id}>
                      <td>{formatDate(income.fecha_ingreso, preferences)}</td>
                      <td>{companyLabel(income, t("common.independent"))}</td>
                      <td>{incomeDescription(income, t("common.notRegistered"))}</td>
                      <td>{money(asNumber(income.monto))}</td>
                      <td><span className="income-category"><Icon name="trending_up" /> {categoryLabel(income, t("common.noCategory"))}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="income-empty">
                        <span><Icon name="trending_up" /></span>
                        <strong>{query ? t("income.noSearch") : t("income.empty")}</strong>
                        <small>{query ? t("common.tryAnotherSearch") : t("income.emptyHelp")}</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={incomePage.currentPage}
            end={incomePage.end}
            hrefForPage={(page) => pageHref("/income", resolvedSearchParams, "page", page)}
            language={preferences.language}
            start={incomePage.start}
            totalItems={filteredIncomes.length}
          />
        </section>
      </main>
    </AppShell>
  );
}
