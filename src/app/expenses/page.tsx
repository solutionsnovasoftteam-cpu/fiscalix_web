import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { ExpenseActions } from "@/app/expenses/expense-actions";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

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

type CompanyRow = {
  estado: string | null;
  id: string;
  nombre_comercial: string | null;
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

function categoryLabel(expense: ExpenseRow) {
  return firstRelation(expense.categorias_financieras)?.nombre || "Sin categoría";
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

function companyLabel(expense: ExpenseRow) {
  const registeredCompany = firstRelation(expense.empresas)?.nombre_comercial;
  if (registeredCompany) return registeredCompany;

  return splitCustomCompanyConcept(expense.concepto).companyName || "Independiente";
}

function expenseDescription(expense: ExpenseRow) {
  if (firstRelation(expense.empresas)?.nombre_comercial) return fallback(expense.concepto);
  return fallback(splitCustomCompanyConcept(expense.concepto).description);
}

function fallback(value: string | null | undefined) {
  return value?.trim() || "Sin registrar";
}

function isExpenseCategory(category: CategoryRow) {
  const normalized = category.tipo?.trim().toLowerCase();
  return !normalized || ["gasto", "gastos", "egreso", "egresos", "expense", "expenses"].includes(normalized);
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, columnName: string) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42703" || message.includes(columnName.toLowerCase());
}

async function getAccessibleCompanies(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  if (canViewAdminDashboard(user)) {
    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre_comercial,estado")
      .order("nombre_comercial", { ascending: true });

    return {
      companies: ((data ?? []) as CompanyRow[]).filter((company) => company.estado !== "suspendida"),
      error,
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", user.id);

  const companyIds = [...new Set((memberships ?? []).map((item) => item.empresa_id).filter(Boolean))] as string[];
  if (!companyIds.length || membershipError) return { companies: [] as CompanyRow[], error: membershipError };

  const { data, error } = await supabase
    .from("empresas")
    .select("id,nombre_comercial,estado")
    .in("id", companyIds)
    .order("nombre_comercial", { ascending: true });

  return {
    companies: ((data ?? []) as CompanyRow[]).filter((company) => company.estado !== "suspendida"),
    error,
  };
}

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
  const usedCategories = new Set(expenses.map((expense) => expense.categoria_id || categoryLabel(expense))).size;

  return (
    <AppShell activeHref="/expenses" user={user}>
      <main className="expenses-content">
        <header className="expenses-header">
          <div>
            <p>CONTROL DE EGRESOS</p>
            <h1>Gastos</h1>
            <span>Gestiona todos los gastos registrados en tu base de datos.</span>
          </div>
          <ExpenseActions
            categories={expenseCategories.map((category) => ({ id: category.id, nombre: fallback(category.nombre) }))}
            companies={companies.map((company) => ({ id: company.id, nombre: fallback(company.nombre_comercial) }))}
            rows={expenses.map((expense) => ({
              categoria: categoryLabel(expense),
              concepto: expenseDescription(expense),
              empresa: companyLabel(expense),
              fecha_gasto: expense.fecha_gasto,
              id: expense.id,
              monto: asNumber(expense.monto),
            }))}
          />
        </header>

        {(companiesError || companyExpensesResult.error || (!isMissingColumnError(userExpensesResult.error, "usuario_id") && userExpensesResult.error) || categoriesResult.error) && (
          <section className="expenses-alert" role="alert">
            <strong>No fue posible cargar los gastos.</strong>
            <span>Revisa la conexión con Supabase o los permisos de la tabla gastos.</span>
          </section>
        )}

        <section className="expenses-table-card">
          <div className="expenses-table-scroll">
            <table className="expenses-table">
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
                {expenses.length ? (
                  expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.fecha_gasto)}</td>
                      <td>{companyLabel(expense)}</td>
                      <td>{expenseDescription(expense)}</td>
                      <td>{moneyFormatter.format(asNumber(expense.monto))}</td>
                      <td><span className="expense-category"><Icon name="category" /> {categoryLabel(expense)}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="expenses-empty">
                        <span><Icon name="trending_down" /></span>
                        <strong>No hay gastos registrados</strong>
                        <small>Cuando registres gastos en Supabase, aparecerán aquí automáticamente.</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="expenses-stat-grid">
          <article>
            <span><Icon name="trending_down" /></span>
            <div>
              <small>Total de gastos</small>
              <strong>{moneyFormatter.format(total)}</strong>
              <p>{expenses.length} registros</p>
            </div>
          </article>
          <article>
            <span><Icon name="calculate" /></span>
            <div>
              <small>Promedio por gasto</small>
              <strong>{moneyFormatter.format(average)}</strong>
              <p>Calculado desde la tabla gastos</p>
            </div>
          </article>
          <article>
            <span><Icon name="south" /></span>
            <div>
              <small>Gasto más alto</small>
              <strong>{moneyFormatter.format(highest)}</strong>
              <p>{highest ? "Mayor monto registrado" : "Sin registros"}</p>
            </div>
          </article>
          <article>
            <span><Icon name="category" /></span>
            <div>
              <small>Total de categorías</small>
              <strong>{usedCategories}</strong>
              <p>{expenses.length ? "Categorías usadas" : "Sin categorías"}</p>
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
