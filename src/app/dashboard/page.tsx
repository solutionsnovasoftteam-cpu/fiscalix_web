import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { firstName } from "@/lib/utils";

type Relation<T> = T | T[] | null;

type CompanyRow = {
  estado: string | null;
  id: string;
  nombre_comercial: string | null;
};

type FinanceRelation = {
  nombre: string | null;
};

type IncomeRow = {
  categorias_financieras: Relation<FinanceRelation>;
  concepto: string | null;
  empresa_id: string | null;
  empresas: Relation<{ nombre_comercial: string | null }>;
  fecha_ingreso: string | null;
  id: string;
  monto: number | string | null;
};

type ExpenseRow = {
  categorias_financieras: Relation<FinanceRelation>;
  concepto: string | null;
  empresa_id: string | null;
  empresas: Relation<{ nombre_comercial: string | null }>;
  fecha_gasto: string | null;
  id: string;
  monto: number | string | null;
};

type ObligationRow = {
  activa: boolean | null;
  descripcion: string | null;
  empresa_id: string | null;
  id: string;
  nombre: string | null;
  periodicidad: string | null;
};

type SubscriptionRow = {
  empresa_id: string | null;
  estado_pago: string | null;
  fecha_proxima_facturacion: string | null;
  id: string;
  planes: Relation<{ nombre: string | null }>;
};

type Movement = {
  amount: number;
  company: string;
  concept: string;
  date: string;
  id: string;
  tone: "positive" | "negative";
  type: "Ingreso" | "Gasto";
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

const monthFormatter = new Intl.DateTimeFormat("es-MX", {
  month: "short",
});

const billingStatusLabels: Record<string, string> = {
  pago_no_acreditado: "Pago no acreditado",
  pagado_exito_mes: "Pagado con éxito este mes",
  proxima_a_pagar: "Próxima a pagar",
  revision_manual: "Revisión manual",
};

function firstRelation<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function compareDatesDesc(a: string | null | undefined, b: string | null | undefined) {
  return String(b ?? "").localeCompare(String(a ?? ""));
}

function compareDatesAsc(a: string | null | undefined, b: string | null | undefined) {
  return String(a ?? "").localeCompare(String(b ?? ""));
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

function buildMonthlySummary(incomes: IncomeRow[], expenses: ExpenseRow[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = dateKey(date).slice(0, 7);
    return {
      expenses: 0,
      incomes: 0,
      key,
      label: monthFormatter.format(date).replace(".", ""),
    };
  });

  const summaryByMonth = new Map(months.map((month) => [month.key, month]));

  for (const income of incomes) {
    const month = income.fecha_ingreso?.slice(0, 7);
    const summary = month ? summaryByMonth.get(month) : null;
    if (summary) summary.incomes += asNumber(income.monto);
  }

  for (const expense of expenses) {
    const month = expense.fecha_gasto?.slice(0, 7);
    const summary = month ? summaryByMonth.get(month) : null;
    if (summary) summary.expenses += asNumber(expense.monto);
  }

  return months;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = new Date();
  const currentMonthStart = dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const nextMonthStart = dateKey(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  const sixMonthStart = dateKey(new Date(today.getFullYear(), today.getMonth() - 5, 1));
  const todayKey = dateKey(today);

  const { companies, error: companiesError } = await getAccessibleCompanies(user);
  const companyIds = companies.map((company) => company.id);
  const companyNameById = new Map(companies.map((company) => [company.id, company.nombre_comercial || "Sin empresa"]));

  const [incomeResult, expenseResult, obligationsResult, subscriptionsResult] = companyIds.length
    ? await Promise.all([
        supabase
          .from("ingresos")
          .select("id,concepto,monto,fecha_ingreso,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
          .in("empresa_id", companyIds)
          .gte("fecha_ingreso", sixMonthStart)
          .order("fecha_ingreso", { ascending: false }),
        supabase
          .from("gastos")
          .select("id,concepto,monto,fecha_gasto,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
          .in("empresa_id", companyIds)
          .gte("fecha_gasto", sixMonthStart)
          .order("fecha_gasto", { ascending: false }),
        supabase
          .from("obligaciones_fiscales")
          .select("id,empresa_id,nombre,periodicidad,descripcion,activa")
          .in("empresa_id", companyIds)
          .eq("activa", true),
        supabase
          .from("suscripciones")
          .select("id,empresa_id,estado_pago,fecha_proxima_facturacion,planes(nombre)")
          .in("empresa_id", companyIds),
      ])
    : [
        { data: [] as IncomeRow[], error: null },
        { data: [] as ExpenseRow[], error: null },
        { data: [] as ObligationRow[], error: null },
        { data: [] as SubscriptionRow[], error: null },
      ];

  const incomes = (incomeResult.data ?? []) as IncomeRow[];
  const expenses = (expenseResult.data ?? []) as ExpenseRow[];
  const obligations = (obligationsResult.data ?? []) as ObligationRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const hasError = companiesError || incomeResult.error || expenseResult.error || obligationsResult.error || subscriptionsResult.error;

  const monthIncomes = incomes.filter((income) => income.fecha_ingreso && income.fecha_ingreso >= currentMonthStart && income.fecha_ingreso < nextMonthStart);
  const monthExpenses = expenses.filter((expense) => expense.fecha_gasto && expense.fecha_gasto >= currentMonthStart && expense.fecha_gasto < nextMonthStart);
  const monthlyIncomeTotal = monthIncomes.reduce((sum, income) => sum + asNumber(income.monto), 0);
  const monthlyExpenseTotal = monthExpenses.reduce((sum, expense) => sum + asNumber(expense.monto), 0);
  const balance = monthlyIncomeTotal - monthlyExpenseTotal;

  const sortedSubscriptions = subscriptions
    .filter((subscription) => subscription.fecha_proxima_facturacion)
    .sort((a, b) => compareDatesAsc(a.fecha_proxima_facturacion, b.fecha_proxima_facturacion));
  const nextSubscription = sortedSubscriptions.find((subscription) => String(subscription.fecha_proxima_facturacion) >= todayKey) ?? sortedSubscriptions[0] ?? null;
  const firstObligation = obligations[0] ?? null;
  const nextObligationValue = nextSubscription ? "Facturación" : firstObligation?.nombre || "—";
  const nextObligationHelp = nextSubscription
    ? `${formatDate(nextSubscription.fecha_proxima_facturacion)} · ${billingStatusLabels[nextSubscription.estado_pago ?? ""] ?? "Suscripción activa"}`
    : firstObligation
      ? firstObligation.periodicidad || "Obligación fiscal activa"
      : companyIds.length
        ? "Sin obligaciones próximas"
        : "Agrega una empresa para comenzar";

  const stats = [
    {
      help: monthIncomes.length ? `${monthIncomes.length} registros este mes` : "Sin ingresos este mes",
      icon: "trending_up",
      title: "Ingresos del mes",
      value: moneyFormatter.format(monthlyIncomeTotal),
    },
    {
      help: monthExpenses.length ? `${monthExpenses.length} registros este mes` : "Sin gastos este mes",
      icon: "trending_down",
      title: "Gastos del mes",
      value: moneyFormatter.format(monthlyExpenseTotal),
    },
    {
      help: "Ingresos menos gastos del mes",
      icon: "account_balance_wallet",
      title: "Balance",
      value: moneyFormatter.format(balance),
    },
    {
      help: nextObligationHelp,
      icon: "event_note",
      title: "Próxima obligación",
      value: nextObligationValue,
    },
  ];

  const monthlySummary = buildMonthlySummary(incomes, expenses);
  const highestMonthlyValue = Math.max(0, ...monthlySummary.flatMap((month) => [month.incomes, month.expenses]));
  const hasFinancialData = incomes.length > 0 || expenses.length > 0;

  const movements: Movement[] = [
    ...incomes.map((income) => ({
      amount: asNumber(income.monto),
      company: firstRelation(income.empresas)?.nombre_comercial || (income.empresa_id ? companyNameById.get(income.empresa_id) : null) || "Sin empresa",
      concept: income.concepto || "Ingreso sin descripción",
      date: income.fecha_ingreso || "",
      id: `income-${income.id}`,
      tone: "positive" as const,
      type: "Ingreso" as const,
    })),
    ...expenses.map((expense) => ({
      amount: asNumber(expense.monto),
      company: firstRelation(expense.empresas)?.nombre_comercial || (expense.empresa_id ? companyNameById.get(expense.empresa_id) : null) || "Sin empresa",
      concept: expense.concepto || "Gasto sin descripción",
      date: expense.fecha_gasto || "",
      id: `expense-${expense.id}`,
      tone: "negative" as const,
      type: "Gasto" as const,
    })),
  ]
    .filter((movement) => movement.date)
    .sort((a, b) => compareDatesDesc(a.date, b.date))
    .slice(0, 6);

  const obligationItems = [
    ...sortedSubscriptions.slice(0, 3).map((subscription) => ({
      description: billingStatusLabels[subscription.estado_pago ?? ""] ?? "Suscripción activa",
      id: `subscription-${subscription.id}`,
      meta: `${companyNameById.get(subscription.empresa_id ?? "") ?? "Sin empresa"} · ${formatDate(subscription.fecha_proxima_facturacion)}`,
      title: firstRelation(subscription.planes)?.nombre ? `Plan ${firstRelation(subscription.planes)?.nombre}` : "Próxima facturación",
    })),
    ...obligations.slice(0, 3).map((obligation) => ({
      description: obligation.descripcion || companyNameById.get(obligation.empresa_id ?? "") || "Obligación fiscal activa",
      id: `obligation-${obligation.id}`,
      meta: obligation.periodicidad || "Periodicidad pendiente",
      title: obligation.nombre || "Obligación fiscal",
    })),
  ].slice(0, 4);

  return (
    <main className="dashboard-content">
      <div className="welcome">
        <div>
          <p>RESUMEN GENERAL</p>
          <h1>Hola, {firstName(user.nombre)} <span>👋</span></h1>
          <span>Aquí tienes el resumen de tu actividad fiscal.</span>
        </div>
        <button className="primary-button compact" type="button"><Icon name="add" /> Registrar movimiento</button>
      </div>

      {hasError && (
        <section className="dashboard-alert" role="alert">
          <strong>No fue posible cargar todo el resumen.</strong>
          <span>Revisa la conexión con Supabase o los permisos de las tablas financieras.</span>
        </section>
      )}

      <section className="stats-grid">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.title}>
            <div>
              <p>{stat.title}</p>
              <h2>{stat.value}</h2>
              <small>{stat.help}</small>
            </div>
            <span><Icon name={stat.icon} /></span>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Resumen financiero</h2>
              <p>Ingresos y gastos de los últimos 6 meses</p>
            </div>
            <select aria-label="Periodo" defaultValue="6">
              <option value="6">Últimos 6 meses</option>
            </select>
          </div>
          {hasFinancialData ? (
            <div className="finance-summary">
              {monthlySummary.map((month) => {
                const incomeWidth = highestMonthlyValue ? Math.max(3, (month.incomes / highestMonthlyValue) * 100) : 0;
                const expenseWidth = highestMonthlyValue ? Math.max(3, (month.expenses / highestMonthlyValue) * 100) : 0;
                return (
                  <div className="finance-month" key={month.key}>
                    <span>{month.label}</span>
                    <div>
                      <i className="income-bar" style={{ width: `${incomeWidth}%` }} />
                      <i className="expense-bar" style={{ width: `${expenseWidth}%` }} />
                    </div>
                    <small>{moneyFormatter.format(month.incomes - month.expenses)}</small>
                  </div>
                );
              })}
              <div className="finance-legend">
                <span><i className="income-bar" />Ingresos</span>
                <span><i className="expense-bar" />Gastos</span>
              </div>
            </div>
          ) : (
            <div className="empty-chart">
              <div className="chart-lines"><i /><i /><i /><i /></div>
              <span><Icon name="bar_chart" /></span>
              <h3>Aún no hay información para mostrar</h3>
              <p>Registra tus primeros movimientos para ver la gráfica.</p>
              <button type="button">Registrar movimiento</button>
            </div>
          )}
        </article>

        <article className="panel obligations">
          <div className="panel-heading">
            <div>
              <h2>Próximas obligaciones</h2>
              <p>Mantente al día con tus fechas</p>
            </div>
            <a href="/companies">Ver todas</a>
          </div>
          {obligationItems.length ? (
            <div className="obligation-list">
              {obligationItems.map((item) => (
                <article key={item.id}>
                  <span><Icon name="event_note" /></span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                    <p>{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-small">
              <span><Icon name="check" /></span>
              <h3>Todo en orden</h3>
              <p>No tienes obligaciones próximas.</p>
            </div>
          )}
        </article>

        <article className="panel movements">
          <div className="panel-heading">
            <div>
              <h2>Movimientos recientes</h2>
              <p>Tu actividad más reciente</p>
            </div>
            <a href="/income">Ver ingresos</a>
          </div>
          <div className="table-head"><span>DESCRIPCIÓN</span><span>TIPO</span><span>FECHA</span><span>MONTO</span></div>
          {movements.length ? (
            <div className="movement-list">
              {movements.map((movement) => (
                <div className="movement-row" key={movement.id}>
                  <div>
                    <strong>{movement.concept}</strong>
                    <small>{movement.company}</small>
                  </div>
                  <span className={`movement-type ${movement.tone}`}>{movement.type}</span>
                  <time>{formatDate(movement.date)}</time>
                  <b className={movement.tone}>
                    {movement.tone === "positive" ? "+" : "-"}{moneyFormatter.format(movement.amount)}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-row"><span><Icon name="sync_alt" /></span><p>No hay movimientos registrados</p></div>
          )}
        </article>
      </section>
    </main>
  );
}
