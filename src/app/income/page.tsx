import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { IncomeActions } from "@/app/income/income-actions";
import { getAccessibleCompanies, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";

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

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function asNumber(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function categoryLabel(income: IncomeRow) {
  return firstRelation(income.categorias_financieras)?.nombre || "Sin categoría";
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

function companyLabel(income: IncomeRow) {
  const registeredCompany = firstRelation(income.empresas)?.nombre_comercial;
  if (registeredCompany) return registeredCompany;

  return splitCustomCompanyConcept(income.concepto).companyName || "Independiente";
}

function incomeDescription(income: IncomeRow) {
  if (firstRelation(income.empresas)?.nombre_comercial) return fallback(income.concepto);
  return fallback(splitCustomCompanyConcept(income.concepto).description);
}

function fallback(value: string | null | undefined) {
  return value?.trim() || "Sin registrar";
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
    formatDate(income.fecha_ingreso),
    income.fecha_ingreso,
    companyLabel(income),
    incomeDescription(income),
    categoryLabel(income),
    asNumber(income.monto),
    moneyFormatter.format(asNumber(income.monto)),
  ], query));
  const incomePage = paginateItems(filteredIncomes, pageFromParam(resolvedSearchParams.page));

  return (
    <AppShell activeHref="/income" user={user}>
      <main className="income-content">
        <header className="income-header">
          <div>
            <h1>Ingresos</h1>
            <span>Gestiona todos los ingresos registrados en tu base de datos.</span>
          </div>
          <IncomeActions
            categories={incomeCategories.map((category) => ({ id: category.id, nombre: fallback(category.nombre) }))}
            companies={companies.map((company) => ({ id: company.id, nombre: fallback(company.nombre_comercial) }))}
            rows={incomes.map((income) => ({
              categoria: categoryLabel(income),
              concepto: incomeDescription(income),
              empresa: companyLabel(income),
              fecha_ingreso: income.fecha_ingreso,
              id: income.id,
              monto: asNumber(income.monto),
            }))}
          />
        </header>

        {(companiesError || companyIncomeResult.error || (!isMissingColumnError(userIncomeResult.error, "usuario_id") && userIncomeResult.error) || categoriesResult.error) && (
          <section className="income-alert" role="alert">
            <strong>No fue posible cargar los ingresos.</strong>
            <span>Revisa la conexión con Supabase o los permisos de la tabla ingresos.</span>
          </section>
        )}

        <section className="income-stat-grid">
          <article>
            <span><Icon name="attach_money" /></span>
            <div>
              <small>Ingresos totales</small>
              <strong>{moneyFormatter.format(total)}</strong>
              <p>Calculado desde la tabla ingresos</p>
            </div>
          </article>
          <article>
            <span><Icon name="receipt_long" /></span>
            <div>
              <small>Total de ingresos</small>
              <strong>{incomes.length}</strong>
              <p>{incomes.length === 1 ? "registro" : "registros"}</p>
            </div>
          </article>
          <article>
            <span><Icon name="calculate" /></span>
            <div>
              <small>Promedio por ingreso</small>
              <strong>{moneyFormatter.format(average)}</strong>
              <p>{incomes.length ? "Promedio real registrado" : "Sin registros"}</p>
            </div>
          </article>
          <article>
            <span><Icon name="category" /></span>
            <div>
              <small>Categorías usadas</small>
              <strong>{categories}</strong>
              <p>{uncategorized ? `${uncategorized} sin categoría` : "Sin pendientes de categoría"}</p>
            </div>
          </article>
        </section>

        <section className="income-table-card">
          <div className="income-toolbar">
            <div className="income-tabs" aria-label="Filtros de ingresos">
              <button className="active" type="button">Todos</button>
              <button type="button">Categorizados</button>
              <button type="button">Sin categoría</button>
            </div>
            <div className="income-tools">
              <TableSearch
                label="Buscar ingresos"
                pathname="/income"
                placeholder="Buscar por empresa, descripción, categoría, fecha o monto..."
                searchParams={resolvedSearchParams}
              />
              <button type="button"><Icon name="filter_list" /> Filtrar</button>
            </div>
          </div>

          <div className="income-table-scroll">
            <table className="income-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Empresa</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Categoría</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncomes.length ? (
                  incomePage.items.map((income) => (
                    <tr key={income.id}>
                      <td>{formatDate(income.fecha_ingreso)}</td>
                      <td>{companyLabel(income)}</td>
                      <td>{incomeDescription(income)}</td>
                      <td>{moneyFormatter.format(asNumber(income.monto))}</td>
                      <td><span className="income-category"><Icon name="trending_up" /> {categoryLabel(income)}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="income-empty">
                        <span><Icon name="trending_up" /></span>
                        <strong>{query ? "No encontramos ingresos" : "No hay ingresos registrados"}</strong>
                        <small>{query ? "Prueba con otro término de búsqueda." : "Cuando registres ingresos en Supabase, aparecerán aquí automáticamente."}</small>
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
            start={incomePage.start}
            totalItems={filteredIncomes.length}
          />
        </section>
      </main>
    </AppShell>
  );
}
