import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardExportButton } from "@/app/dashboard/dashboard-export-button";
import { Icon } from "@/components/Icon";
import { getAccessibleCompanies, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { isRowInAccessibleCompanyScope } from "@/lib/financialMovements";
import { createTranslator } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { loadTaxEstimationsForUser } from "@/lib/taxEstimation";
import {
  defaultUserPreferences,
  formatPreferenceDate,
  formatPreferenceMoney,
  formatPreferenceMonth,
  type UserPreferences,
} from "@/lib/userPreferences.shared";
import { firstName } from "@/lib/utils";

type Relation<T> = T | T[] | null;

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
  usuario_id?: string | null;
};

type ExpenseRow = {
  categorias_financieras: Relation<FinanceRelation>;
  concepto: string | null;
  empresa_id: string | null;
  empresas: Relation<{ nombre_comercial: string | null }>;
  fecha_gasto: string | null;
  id: string;
  monto: number | string | null;
  usuario_id?: string | null;
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

function formatDate(value: string | null | undefined, preferences: UserPreferences) {
  return formatPreferenceDate(value, preferences);
}

function formatMonthPeriod(key: string, preferences: UserPreferences) {
  const date = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? key : formatPreferenceMonth(date, preferences, true);
}

function compareDatesDesc(a: string | null | undefined, b: string | null | undefined) {
  return String(b ?? "").localeCompare(String(a ?? ""));
}

function compareDatesAsc(a: string | null | undefined, b: string | null | undefined) {
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function buildMonthlySummary(incomes: IncomeRow[], expenses: ExpenseRow[], preferences: UserPreferences) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = dateKey(date).slice(0, 7);
    return {
      expenses: 0,
      incomes: 0,
      key,
      label: formatPreferenceMonth(date, preferences),
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

function buildFinanceLinePoints(
  months: ReturnType<typeof buildMonthlySummary>,
  field: "expenses" | "incomes",
  maxValue: number,
) {
  const left = 86;
  const right = 28;
  const top = 24;
  const bottom = 198;
  const width = 680 - left - right;
  const height = bottom - top;
  const divisor = Math.max(1, months.length - 1);

  return months.map((month, index) => {
    const x = left + (width / divisor) * index;
    const y = bottom - (Math.max(0, month[field]) / maxValue) * height;
    return {
      label: month.label,
      value: month[field],
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  });
}

function buildSvgPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

function buildSvgAreaPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  const bottom = 198;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  return `${buildSvgPath(points)} L ${lastPoint.x} ${bottom} L ${firstPoint.x} ${bottom} Z`;
}

function buildFinanceTicks(maxValue: number) {
  const top = 24;
  const bottom = 198;
  const height = bottom - top;

  return [1, 2 / 3, 1 / 3, 0].map((ratio) => ({
    value: maxValue * ratio,
    y: Number((bottom - height * ratio).toFixed(2)),
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const preferences = user.preferences ?? defaultUserPreferences;
  const t = createTranslator(preferences.language);
  const money = (value: number) => formatPreferenceMoney(value, preferences);
  const billingStatusLabels: Record<string, string> = {
    pago_no_acreditado: t("billing.pago_no_acreditado"),
    pagado_exito_mes: t("billing.pagado_exito_mes"),
    proxima_a_pagar: t("billing.proxima_a_pagar"),
    revision_manual: t("billing.revision_manual"),
  };

  const today = new Date();
  const currentMonthStart = dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const nextMonthStart = dateKey(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  const sixMonthStart = dateKey(new Date(today.getFullYear(), today.getMonth() - 5, 1));
  const todayKey = dateKey(today);

  const { companies, error: companiesError } = await getAccessibleCompanies(user);
  const companyIds = companies.map((company) => company.id);
  const companyIdSet = new Set(companyIds);
  const companyNameById = new Map(companies.map((company) => [company.id, company.nombre_comercial || t("common.noCompany")]));

  const [companyIncomeResult, userIncomeResult, companyExpenseResult, userExpenseResult, obligationsResult, subscriptionsResult, fiscalEstimationResult] = await Promise.all([
    companyIds.length
      ? supabase
          .from("ingresos")
          .select("id,concepto,monto,fecha_ingreso,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
          .in("empresa_id", companyIds)
          .gte("fecha_ingreso", sixMonthStart)
          .order("fecha_ingreso", { ascending: false })
      : Promise.resolve({ data: [] as IncomeRow[], error: null }),
    supabase
      .from("ingresos")
      .select("id,concepto,monto,usuario_id,fecha_ingreso,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
      .eq("usuario_id", user.id)
      .gte("fecha_ingreso", sixMonthStart)
      .order("fecha_ingreso", { ascending: false }),
    companyIds.length
      ? supabase
          .from("gastos")
          .select("id,concepto,monto,fecha_gasto,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
          .in("empresa_id", companyIds)
          .gte("fecha_gasto", sixMonthStart)
          .order("fecha_gasto", { ascending: false })
      : Promise.resolve({ data: [] as ExpenseRow[], error: null }),
    supabase
      .from("gastos")
      .select("id,concepto,monto,usuario_id,fecha_gasto,empresa_id,empresas(nombre_comercial),categorias_financieras(nombre)")
      .eq("usuario_id", user.id)
      .gte("fecha_gasto", sixMonthStart)
      .order("fecha_gasto", { ascending: false }),
    companyIds.length
      ? supabase
          .from("obligaciones_fiscales")
          .select("id,empresa_id,nombre,periodicidad,descripcion,activa")
          .in("empresa_id", companyIds)
          .eq("activa", true)
      : Promise.resolve({ data: [] as ObligationRow[], error: null }),
    companyIds.length
      ? supabase
          .from("suscripciones")
          .select("id,empresa_id,estado_pago,fecha_proxima_facturacion,planes(nombre)")
          .in("empresa_id", companyIds)
      : Promise.resolve({ data: [] as SubscriptionRow[], error: null }),
    loadTaxEstimationsForUser(user, { persist: false }),
  ]);

  const userIncomes = isMissingColumnError(userIncomeResult.error, "usuario_id")
    ? []
    : ((userIncomeResult.data ?? []) as IncomeRow[]).filter((income) => isRowInAccessibleCompanyScope(income, companyIdSet));
  const userExpenses = isMissingColumnError(userExpenseResult.error, "usuario_id")
    ? []
    : ((userExpenseResult.data ?? []) as ExpenseRow[]).filter((expense) => isRowInAccessibleCompanyScope(expense, companyIdSet));
  const incomesById = new Map<string, IncomeRow>();
  const expensesById = new Map<string, ExpenseRow>();
  for (const income of [...((companyIncomeResult.data ?? []) as IncomeRow[]), ...userIncomes]) incomesById.set(income.id, income);
  for (const expense of [...((companyExpenseResult.data ?? []) as ExpenseRow[]), ...userExpenses]) expensesById.set(expense.id, expense);
  const incomes = Array.from(incomesById.values());
  const expenses = Array.from(expensesById.values());
  const obligations = (obligationsResult.data ?? []) as ObligationRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const hasError = companiesError
    || companyIncomeResult.error
    || (!isMissingColumnError(userIncomeResult.error, "usuario_id") && userIncomeResult.error)
    || companyExpenseResult.error
    || (!isMissingColumnError(userExpenseResult.error, "usuario_id") && userExpenseResult.error)
    || obligationsResult.error
    || subscriptionsResult.error;
  const fiscalEstimation = fiscalEstimationResult.data;
  const fiscalRows = fiscalEstimation?.companies ?? [];
  const fiscalPeriod = fiscalEstimation?.period.key ?? currentMonthStart.slice(0, 7);
  const fiscalTotals = fiscalEstimation?.totals;

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
  const nextObligationValue = nextSubscription ? t("dashboard.billing") : firstObligation?.nombre || "—";
  const nextObligationHelp = nextSubscription
    ? `${formatDate(nextSubscription.fecha_proxima_facturacion, preferences)} · ${billingStatusLabels[nextSubscription.estado_pago ?? ""] ?? t("dashboard.activeSubscription")}`
    : firstObligation
      ? firstObligation.periodicidad || t("dashboard.activeFiscalObligation")
      : companyIds.length
        ? t("dashboard.noUpcomingObligations")
        : t("dashboard.addCompany");

  const stats = [
    {
      help: monthIncomes.length ? t("dashboard.recordsThisMonth", { count: monthIncomes.length }) : t("dashboard.noIncomeMonth"),
      icon: "trending_up",
      title: t("dashboard.incomeMonth"),
      value: money(monthlyIncomeTotal),
    },
    {
      help: monthExpenses.length ? t("dashboard.recordsThisMonth", { count: monthExpenses.length }) : t("dashboard.noExpensesMonth"),
      icon: "trending_down",
      title: t("dashboard.expensesMonth"),
      value: money(monthlyExpenseTotal),
    },
    {
      help: t("dashboard.balanceHelp"),
      icon: "account_balance_wallet",
      title: t("dashboard.balance"),
      value: money(balance),
    },
    {
      help: nextObligationHelp,
      icon: "event_note",
      title: t("dashboard.nextObligation"),
      value: nextObligationValue,
    },
  ];

  const monthlySummary = buildMonthlySummary(incomes, expenses, preferences);
  const highestMonthlyValue = Math.max(0, ...monthlySummary.flatMap((month) => [month.incomes, month.expenses]));
  const chartMaxValue = Math.max(1, highestMonthlyValue);
  const incomeLinePoints = buildFinanceLinePoints(monthlySummary, "incomes", chartMaxValue);
  const expenseLinePoints = buildFinanceLinePoints(monthlySummary, "expenses", chartMaxValue);
  const incomeLinePath = buildSvgPath(incomeLinePoints);
  const expenseLinePath = buildSvgPath(expenseLinePoints);
  const incomeAreaPath = buildSvgAreaPath(incomeLinePoints);
  const expenseAreaPath = buildSvgAreaPath(expenseLinePoints);
  const financeTicks = buildFinanceTicks(chartMaxValue);
  const hasFinancialData = incomes.length > 0 || expenses.length > 0;

  const movements: Movement[] = [
    ...incomes.map((income) => ({
      amount: asNumber(income.monto),
      company: firstRelation(income.empresas)?.nombre_comercial || (income.empresa_id ? companyNameById.get(income.empresa_id) : null) || t("common.noCompany"),
      concept: income.concepto || t("dashboard.incomeNoDescription"),
      date: income.fecha_ingreso || "",
      id: `income-${income.id}`,
      tone: "positive" as const,
      type: "Ingreso" as const,
    })),
    ...expenses.map((expense) => ({
      amount: asNumber(expense.monto),
      company: firstRelation(expense.empresas)?.nombre_comercial || (expense.empresa_id ? companyNameById.get(expense.empresa_id) : null) || t("common.noCompany"),
      concept: expense.concepto || t("dashboard.expenseNoDescription"),
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
      description: billingStatusLabels[subscription.estado_pago ?? ""] ?? t("dashboard.activeSubscription"),
      id: `subscription-${subscription.id}`,
      meta: `${companyNameById.get(subscription.empresa_id ?? "") ?? t("common.noCompany")} · ${formatDate(subscription.fecha_proxima_facturacion, preferences)}`,
      title: firstRelation(subscription.planes)?.nombre ? `Plan ${firstRelation(subscription.planes)?.nombre}` : t("dashboard.nextBilling"),
    })),
    ...obligations.slice(0, 3).map((obligation) => ({
      description: obligation.descripcion || companyNameById.get(obligation.empresa_id ?? "") || t("dashboard.activeFiscalObligation"),
      id: `obligation-${obligation.id}`,
      meta: obligation.periodicidad || t("common.pending"),
      title: obligation.nombre || t("dashboard.fiscalObligation"),
    })),
  ].slice(0, 4);

  const exportData = {
    generatedFor: [user.nombre, user.apellido].filter(Boolean).join(" ") || user.correo,
    monthlySummary,
    movements,
    obligations: obligationItems,
    stats: stats.map((stat) => ({
      help: stat.help,
      title: stat.title,
      value: stat.value,
    })),
  };

  return (
    <main className="dashboard-content">
      <div className="welcome">
        <div>
          <p>{t("dashboard.eyebrow")}</p>
          <h1>{t("dashboard.greeting", { name: firstName(user.nombre) })}</h1>
          <span>{t("dashboard.help")}</span>
        </div>
        <DashboardExportButton data={exportData} preferences={preferences} />
      </div>

      {hasError && (
        <section className="dashboard-alert" role="alert">
          <strong>{t("dashboard.errorTitle")}</strong>
          <span>{t("dashboard.errorHelp")}</span>
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

      <section className="panel dashboard-tax-summary">
        <div className="panel-heading">
          <div>
            <h2>{t("dashboard.taxSummary")}</h2>
            <p>{t("dashboard.taxSummaryHelp")}</p>
          </div>
          <Link href={`/taxes?period=${fiscalPeriod}`}>{t("dashboard.viewTaxes")}</Link>
        </div>

        {fiscalEstimationResult.error ? (
          <div className="dashboard-tax-empty">
            <strong>{t("dashboard.taxNoEstimate")}</strong>
            <span>{fiscalEstimationResult.error}</span>
          </div>
        ) : fiscalRows.length ? (
          <>
            <div className="dashboard-tax-kpis">
              <div>
                <span>{t("dashboard.taxPeriod", { period: formatMonthPeriod(fiscalPeriod, preferences) })}</span>
                <strong>{fiscalPeriod}</strong>
              </div>
              <div>
                <span>{t("dashboard.taxAvailable", { count: fiscalTotals?.companiesWithEstimate ?? 0 })}</span>
                <strong>{fiscalTotals?.companiesWithEstimate ?? 0}</strong>
              </div>
              <div>
                <span>{t("taxes.estimatedTaxTotal")}</span>
                <strong>{money(fiscalTotals?.taxEstimated ?? 0)}</strong>
              </div>
            </div>
            <div className="reports-table-scroll">
              <table className="reports-table dashboard-tax-table">
                <thead>
                  <tr>
                    <th>{t("taxes.companyFilter")}</th>
                    <th>{t("taxes.regime")}</th>
                    <th>{t("taxes.resicoBase")}</th>
                    <th>{t("taxes.estimatedIvaPayable")}</th>
                    <th>{t("taxes.estimatedIsrPayable")}</th>
                    <th>{t("taxes.estimatedTaxTotal")}</th>
                    <th>{t("reports.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {fiscalRows.map((row) => {
                    const status = !row.estimationAvailable
                      ? t("dashboard.taxReview")
                      : row.validationMessages.length
                        ? t("reports.statusLimited")
                        : t("reports.statusEstimated");

                    return (
                      <tr key={row.companyId}>
                        <td><strong>{row.companyName}</strong><small>{t("taxes.movementCounts", { expenses: row.expenseCount, incomes: row.incomeCount })}</small></td>
                        <td><strong>{row.regimeSatCode || "-"}</strong><small>{row.regimeName}</small></td>
                        <td>{money(row.base)}</td>
                        <td>{money(row.vatEstimated ?? 0)}</td>
                        <td>{money(row.isrEstimated ?? 0)}</td>
                        <td>{money(row.taxEstimated ?? 0)}</td>
                        <td><span className={`fiscal-status fiscal-status-${row.estimationAvailable ? (row.validationMessages.length ? "limited" : "estimated") : "review"}`}>{status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="dashboard-tax-empty">
            <strong>{t("dashboard.taxNoEstimate")}</strong>
            <span>{t("taxes.noEstimatesHelp")}</span>
          </div>
        )}
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>{t("dashboard.chartTitle")}</h2>
              <p>{t("dashboard.chartHelp")}</p>
            </div>
            <select aria-label={t("reports.period")} defaultValue="6">
              <option value="6">{t("dashboard.last6Months")}</option>
            </select>
          </div>
          {hasFinancialData ? (
            <div className="finance-summary finance-line-summary">
              <div className="finance-line-chart">
                <svg aria-label={t("dashboard.chartAria")} role="img" viewBox="0 0 680 252">
                  <title>{t("dashboard.chartHelp")}</title>
                  <defs>
                    <linearGradient id="finance-income-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#01c38d" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#01c38d" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="finance-expense-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#ff8b69" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#ff8b69" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {financeTicks.map((tick) => (
                    <g key={tick.y}>
                      <line className="finance-grid-line" x1="86" x2="652" y1={tick.y} y2={tick.y} />
                      <text className="finance-money-label" textAnchor="end" x="76" y={tick.y + 4}>
                        {money(tick.value)}
                      </text>
                    </g>
                  ))}
                  {monthlySummary.map((month, index) => {
                    const x = incomeLinePoints[index]?.x ?? 86;
                    return (
                      <g key={month.key}>
                        <line className="finance-grid-line vertical" x1={x} x2={x} y1="24" y2="198" />
                        <text className="finance-axis-label" textAnchor="middle" x={x} y="229">{month.label}</text>
                      </g>
                    );
                  })}
                  <path className="finance-area finance-area-income" d={incomeAreaPath} />
                  <path className="finance-area finance-area-expense" d={expenseAreaPath} />
                  <path className="finance-line-path finance-line-income" d={incomeLinePath} />
                  <path className="finance-line-path finance-line-expense" d={expenseLinePath} />
                  {incomeLinePoints.map((point, index) => (
                    <g className="finance-point-group" key={`income-${point.label}`} style={{ animationDelay: `${520 + index * 90}ms` }}>
                      <circle className="finance-point-halo finance-point-halo-income" cx={point.x} cy={point.y} r="9" />
                      <circle className="finance-point finance-point-income" cx={point.x} cy={point.y} r="5">
                        <title>{`${point.label} · ${t("dashboard.income")}: ${money(point.value)}`}</title>
                      </circle>
                    </g>
                  ))}
                  {expenseLinePoints.map((point, index) => (
                    <g className="finance-point-group" key={`expense-${point.label}`} style={{ animationDelay: `${620 + index * 90}ms` }}>
                      <circle className="finance-point-halo finance-point-halo-expense" cx={point.x} cy={point.y} r="9" />
                      <circle className="finance-point finance-point-expense" cx={point.x} cy={point.y} r="5">
                        <title>{`${point.label} · ${t("dashboard.expenses")}: ${money(point.value)}`}</title>
                      </circle>
                    </g>
                  ))}
                  {monthlySummary.map((month, index) => {
                    const incomePoint = incomeLinePoints[index];
                    const expensePoint = expenseLinePoints[index];
                    if (!incomePoint || !expensePoint) return null;

                    const x = incomePoint.x;
                    const tooltipWidth = 156;
                    const tooltipX = clamp(x - tooltipWidth / 2, 92, 680 - tooltipWidth - 18);
                    const balanceValue = month.incomes - month.expenses;

                    return (
                      <g
                        aria-label={`${formatMonthPeriod(month.key, preferences)}. ${t("dashboard.income")} ${money(month.incomes)}. ${t("dashboard.expenses")} ${money(month.expenses)}. ${t("dashboard.balance")} ${money(balanceValue)}.`}
                        className="finance-hover-group"
                        key={`hover-${month.key}`}
                        tabIndex={0}
                      >
                        <rect className="finance-hover-zone" height="212" rx="18" width="66" x={x - 33} y="16" />
                        <line className="finance-hover-guide" x1={x} x2={x} y1="24" y2="198" />
                        <g className="finance-tooltip-anchor" transform={`translate(${tooltipX} 31)`}>
                          <g className="finance-tooltip">
                            <rect className="finance-tooltip-card" height="82" rx="12" width={tooltipWidth} />
                            <text className="finance-tooltip-title" x="12" y="18">{formatMonthPeriod(month.key, preferences)}</text>
                            <circle className="finance-tooltip-dot income" cx="15" cy="34" r="4" />
                            <text className="finance-tooltip-label" x="25" y="38">{t("dashboard.income")}</text>
                            <text className="finance-tooltip-value income" textAnchor="end" x={tooltipWidth - 12} y="38">{money(month.incomes)}</text>
                            <circle className="finance-tooltip-dot expense" cx="15" cy="52" r="4" />
                            <text className="finance-tooltip-label" x="25" y="56">{t("dashboard.expenses")}</text>
                            <text className="finance-tooltip-value expense" textAnchor="end" x={tooltipWidth - 12} y="56">{money(month.expenses)}</text>
                            <text className="finance-tooltip-label balance" x="12" y="74">{t("dashboard.balance")}</text>
                            <text className={balanceValue >= 0 ? "finance-tooltip-value income" : "finance-tooltip-value expense"} textAnchor="end" x={tooltipWidth - 12} y="74">
                              {money(balanceValue)}
                            </text>
                          </g>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="finance-legend">
                <span><i className="income-bar" />{t("dashboard.income")}</span>
                <span><i className="expense-bar" />{t("dashboard.expenses")}</span>
              </div>
            </div>
          ) : (
            <div className="empty-chart">
              <div className="chart-lines"><i /><i /><i /><i /></div>
              <span><Icon name="bar_chart" /></span>
              <h3>{t("dashboard.noChartTitle")}</h3>
              <p>{t("dashboard.noChartHelp")}</p>
              <button type="button">{t("nav.movements")}</button>
            </div>
          )}
        </article>

        <article className="panel obligations">
          <div className="panel-heading">
            <div>
              <h2>{t("dashboard.upcomingObligations")}</h2>
              <p>{t("dashboard.keepDates")}</p>
            </div>
            <a href="/companies">{t("dashboard.viewAll")}</a>
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
              <h3>{t("profile.allGood")}</h3>
              <p>{t("dashboard.noUpcomingHelp")}</p>
            </div>
          )}
        </article>

        <article className="panel movements">
          <div className="panel-heading">
            <div>
              <h2>{t("dashboard.recentMovements")}</h2>
              <p>{t("dashboard.recentActivity")}</p>
            </div>
            <a href="/income">{t("nav.income")}</a>
          </div>
          <div className="table-head"><span>{t("dashboard.description").toUpperCase()}</span><span>{t("dashboard.type").toUpperCase()}</span><span>{t("dashboard.date").toUpperCase()}</span><span>{t("dashboard.amount").toUpperCase()}</span></div>
          {movements.length ? (
            <div className="movement-list">
              {movements.map((movement) => (
                <div className="movement-row" key={movement.id}>
                  <div>
                    <strong>{movement.concept}</strong>
                    <small>{movement.company}</small>
                  </div>
                  <span className={`movement-type ${movement.tone}`}>{movement.type === "Ingreso" ? t("dashboard.income") : t("dashboard.expenses")}</span>
                  <time>{formatDate(movement.date, preferences)}</time>
                  <b className={movement.tone}>
                    {movement.tone === "positive" ? "+" : "-"}{money(movement.amount)}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-row"><span><Icon name="sync_alt" /></span><p>{t("transactions.empty")}</p></div>
          )}
        </article>
      </section>
    </main>
  );
}
