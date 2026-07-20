import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type Relation<T> = T | T[] | null;

type Company = {
  id: string;
  nombre_comercial: string | null;
};

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

const money = new Intl.NumberFormat("es-MX", {
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

function firstRelation<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export default async function TransactionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let companies: Company[] = [];
  let companiesError: unknown = null;

  if (canViewAdminDashboard(user)) {
    const result = await supabase
      .from("empresas")
      .select("id,nombre_comercial")
      .neq("estado", "suspendida");
    companies = (result.data ?? []) as Company[];
    companiesError = result.error;
  } else {
    const result = await supabase
      .from("empresa_usuario")
      .select("empresa_id,empresas(id,nombre_comercial)")
      .eq("usuario_id", user.id);
    companies = ((result.data ?? [])
      .flatMap((membership) => membership.empresas ?? []) as Company[]);
    companiesError = result.error;
  }

  const companyIds = [...new Set(companies.map((company) => company.id))];
  const companyNameById = new Map(companies.map((company) => [company.id, company.nombre_comercial || "Sin empresa"]));

  const [incomeResult, expenseResult] = companyIds.length
    ? await Promise.all([
      supabase
        .from("ingresos")
        .select("id,concepto,monto,fecha_ingreso,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
        .in("empresa_id", companyIds)
        .order("fecha_ingreso", { ascending: false })
        .limit(100),
      supabase
        .from("gastos")
        .select("id,concepto,monto,fecha_gasto,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
        .in("empresa_id", companyIds)
        .order("fecha_gasto", { ascending: false })
        .limit(100),
    ])
    : [{ data: [] as FinanceRow[], error: null }, { data: [] as FinanceRow[], error: null }];

  const incomes = ((incomeResult.data ?? []) as Array<Omit<FinanceRow, "fecha"> & { fecha_ingreso: string | null }>)
    .map((income) => ({ ...income, fecha: income.fecha_ingreso }));
  const expenses = ((expenseResult.data ?? []) as Array<Omit<FinanceRow, "fecha"> & { fecha_gasto: string | null }>)
    .map((expense) => ({ ...expense, fecha: expense.fecha_gasto }));

  function toMovement(row: FinanceRow, type: Movement["type"]): Movement {
    return {
      amount: asNumber(row.monto),
      category: firstRelation(row.categorias_financieras)?.nombre || "Sin categoría",
      company: firstRelation(row.empresas)?.nombre_comercial || companyNameById.get(row.empresa_id ?? "") || "Sin empresa",
      concept: row.concepto || `${type} sin descripción`,
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
  const hasError = companiesError || incomeResult.error || expenseResult.error;

  return (
    <AppShell activeHref="/transactions" user={user}>
      <main className="reports-content">
        <header className="reports-header">
          <p>ACTIVIDAD FINANCIERA</p>
          <h1>Movimientos</h1>
          <span>Historial unificado de ingresos y gastos de tus empresas.</span>
        </header>

        {hasError && (
          <section className="dashboard-alert" role="alert">
            <strong>No fue posible cargar todos los movimientos.</strong>
            <span>Revisa la conexión con Supabase o los permisos de las tablas financieras.</span>
          </section>
        )}

        <section className="reports-stats">
          <article><span><Icon name="receipt_long" /></span><small>Total de movimientos</small><strong>{movements.length}</strong></article>
          <article><span><Icon name="trending_up" /></span><small>Ingresos acumulados</small><strong className="positive">{money.format(totalIncome)}</strong></article>
          <article><span><Icon name="trending_down" /></span><small>Gastos acumulados</small><strong className="negative">{money.format(totalExpense)}</strong></article>
          <article><span><Icon name="account_balance_wallet" /></span><small>Balance</small><strong className={totalIncome - totalExpense >= 0 ? "positive" : "negative"}>{money.format(totalIncome - totalExpense)}</strong></article>
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div><h2>Todos los movimientos</h2><p>Los ingresos y gastos se ordenan automáticamente por fecha.</p></div>
            <span>{companies.length} {companies.length === 1 ? "empresa" : "empresas"}</span>
          </div>

          {movements.length ? (
            <div className="reports-table-scroll">
              <table className="reports-table">
                <thead><tr><th>Fecha</th><th>Movimiento</th><th>Empresa</th><th>Categoría</th><th>Tipo</th><th>Monto</th></tr></thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatDate(movement.date)}</td>
                      <td>{movement.concept}</td>
                      <td>{movement.company}</td>
                      <td>{movement.category}</td>
                      <td><span className={movement.type === "Ingreso" ? "admin-status" : "admin-status suspended"}>{movement.type}</span></td>
                      <td className={movement.type === "Ingreso" ? "positive" : "negative"}>{movement.type === "Ingreso" ? "+" : "−"}{money.format(movement.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="reports-empty">
              <span><Icon name="sync_alt" /></span>
              <strong>Aún no hay movimientos registrados</strong>
              <small>Los ingresos y gastos que registres aparecerán aquí en un solo historial.</small>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
