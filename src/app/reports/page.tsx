import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { getAccessibleCompanyIds, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";

type FinanceRow = {
  empresa_id: string | null;
  fecha: string;
  id: string;
  monto: number | string;
};

const money = new Intl.NumberFormat("es-MX", { currency: "MXN", style: "currency" });
const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

function number(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMonth(key: string) {
  return monthLabel.format(new Date(`${key}-01T00:00:00`));
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const resolvedSearchParams = await searchParams;
  const query = searchParamText(resolvedSearchParams, "q");

  const { companyIds, error: scopeError } = await getAccessibleCompanyIds(user);

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
    ...(isMissingColumnError(userIncomeResult.error, "usuario_id") ? [] : (userIncomeResult.data ?? []) as Array<{ empresa_id: string | null; fecha_ingreso: string; id: string; monto: number | string }>),
  ];
  const expenseRows = [
    ...((companyExpenseResult.data ?? []) as Array<{ empresa_id: string | null; fecha_gasto: string; id: string; monto: number | string }>),
    ...(isMissingColumnError(userExpenseResult.error, "usuario_id") ? [] : (userExpenseResult.data ?? []) as Array<{ empresa_id: string | null; fecha_gasto: string; id: string; monto: number | string }>),
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
      formatMonth(key),
      key,
      period.movements,
      money.format(period.incomes),
      money.format(period.expenses),
      money.format(balance),
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
          <div><p>ANÁLISIS FINANCIERO</p><h1>Reportes</h1><span>Resumen consolidado de los movimientos registrados.</span></div>
        </header>

        {hasError && <section className="dashboard-alert" role="alert"><strong>No fue posible cargar todo el reporte.</strong><span>Revisa la conexión o los permisos financieros.</span></section>}

        <section className="reports-stats">
          <article><span><Icon name="trending_up" /></span><small>Ingresos acumulados</small><strong>{money.format(totalIncome)}</strong></article>
          <article><span><Icon name="trending_down" /></span><small>Gastos acumulados</small><strong>{money.format(totalExpense)}</strong></article>
          <article><span><Icon name="account_balance_wallet" /></span><small>Balance acumulado</small><strong className={totalIncome - totalExpense >= 0 ? "positive" : "negative"}>{money.format(totalIncome - totalExpense)}</strong></article>
          <article><span><Icon name="calendar_month" /></span><small>Periodos con actividad</small><strong>{rows.length}</strong></article>
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div><h2>Reporte mensual</h2><p>Ingresos, gastos y balance por periodo</p></div>
            <div className="table-card-actions">
              <TableSearch label="Buscar reportes" pathname="/reports" placeholder="Buscar periodo, monto o balance..." searchParams={resolvedSearchParams} />
              <span>{filteredRows.length} resultado{filteredRows.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          {filteredRows.length ? (
            <>
              <div className="reports-table-scroll"><table className="reports-table"><thead><tr><th>Periodo</th><th>Movimientos</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead><tbody>
                {reportsPage.items.map(([key, period]) => { const balance = period.incomes - period.expenses; return <tr key={key}><td>{formatMonth(key)}</td><td>{period.movements}</td><td className="positive">{money.format(period.incomes)}</td><td className="negative">{money.format(period.expenses)}</td><td className={balance >= 0 ? "positive" : "negative"}>{money.format(balance)}</td></tr>; })}
              </tbody></table></div>
              <TablePagination
                currentPage={reportsPage.currentPage}
                end={reportsPage.end}
                hrefForPage={(page) => pageHref("/reports", resolvedSearchParams, "page", page)}
                start={reportsPage.start}
                totalItems={filteredRows.length}
              />
            </>
          ) : <div className="reports-empty"><span><Icon name="bar_chart" /></span><strong>{query ? "No encontramos reportes" : "Aún no hay periodos para analizar"}</strong><small>{query ? "Prueba con otro término de búsqueda." : "Registra ingresos o gastos y el reporte se generará automáticamente."}</small></div>}
        </section>
      </main>
    </AppShell>
  );
}
