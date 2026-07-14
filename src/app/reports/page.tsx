import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type FinanceRow = {
  empresa_id: string | null;
  fecha: string;
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

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let companyIds: string[] = [];
  let scopeError: unknown = null;
  if (canViewAdminDashboard(user)) {
    const result = await supabase.from("empresas").select("id").neq("estado", "suspendida");
    companyIds = (result.data ?? []).map((item) => item.id);
    scopeError = result.error;
  } else {
    const result = await supabase.from("empresa_usuario").select("empresa_id").eq("usuario_id", user.id);
    companyIds = [...new Set((result.data ?? []).map((item) => item.empresa_id).filter(Boolean))] as string[];
    scopeError = result.error;
  }

  const [incomeResult, expenseResult] = companyIds.length
    ? await Promise.all([
        supabase.from("ingresos").select("empresa_id,fecha_ingreso,monto").in("empresa_id", companyIds).order("fecha_ingreso", { ascending: false }),
        supabase.from("gastos").select("empresa_id,fecha_gasto,monto").in("empresa_id", companyIds).order("fecha_gasto", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const incomes: FinanceRow[] = (incomeResult.data ?? []).map((row) => ({ empresa_id: row.empresa_id, fecha: row.fecha_ingreso, monto: row.monto }));
  const expenses: FinanceRow[] = (expenseResult.data ?? []).map((row) => ({ empresa_id: row.empresa_id, fecha: row.fecha_gasto, monto: row.monto }));
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
  const hasError = scopeError || incomeResult.error || expenseResult.error;

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
          <div className="reports-card-heading"><div><h2>Reporte mensual</h2><p>Ingresos, gastos y balance por periodo</p></div><span>{companyIds.length} {companyIds.length === 1 ? "empresa" : "empresas"}</span></div>
          {rows.length ? (
            <div className="reports-table-scroll"><table className="reports-table"><thead><tr><th>Periodo</th><th>Movimientos</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead><tbody>
              {rows.map(([key, period]) => { const balance = period.incomes - period.expenses; return <tr key={key}><td>{formatMonth(key)}</td><td>{period.movements}</td><td className="positive">{money.format(period.incomes)}</td><td className="negative">{money.format(period.expenses)}</td><td className={balance >= 0 ? "positive" : "negative"}>{money.format(balance)}</td></tr>; })}
            </tbody></table></div>
          ) : <div className="reports-empty"><span><Icon name="bar_chart" /></span><strong>Aún no hay periodos para analizar</strong><small>Registra ingresos o gastos y el reporte se generará automáticamente.</small></div>}
        </section>
      </main>
    </AppShell>
  );
}
