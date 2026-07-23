import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CentroFiscalHub, type CentroFiscalInitialData } from "@/app/centro-fiscal/centro-fiscal-hub";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type Relation<T> = T | T[] | null;

type IncomeRow = {
  categorias_financieras: Relation<{ nombre: string | null }>;
  concepto: string | null;
  empresa_id: string | null;
  fecha_ingreso: string | null;
  id: string;
  monto: number | string | null;
};

type ExpenseRow = {
  categorias_financieras: Relation<{ nombre: string | null }>;
  concepto: string | null;
  empresa_id: string | null;
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

function taxEstimate(name: string, base: number) {
  const normalized = name.toLowerCase();
  if (normalized.includes("iva")) return base * 0.16;
  if (normalized.includes("isr")) return base * 0.1;
  if (normalized.includes("retencion") || normalized.includes("retenciones")) return base * 0.05;
  return base * 0.03;
}

async function getCompanyIds(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  if (canViewAdminDashboard(user)) {
    const { data } = await supabase.from("empresas").select("id").neq("estado", "suspendida");
    return (data ?? []).map((company) => company.id);
  }

  const { data } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", user.id);

  return [...new Set((data ?? []).map((membership) => membership.empresa_id).filter(Boolean))] as string[];
}

export default async function CentroFiscalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const now = new Date();
  const companyIds = await getCompanyIds(user);
  const monthStart = dateKey(new Date(now.getFullYear(), now.getMonth(), 1));

  const [incomeResult, expenseResult, obligationResult] = companyIds.length
    ? await Promise.all([
      supabase
        .from("ingresos")
        .select("id,concepto,monto,fecha_ingreso,empresa_id,categorias_financieras(nombre)")
        .in("empresa_id", companyIds)
        .order("fecha_ingreso", { ascending: false })
        .limit(80),
      supabase
        .from("gastos")
        .select("id,concepto,monto,fecha_gasto,empresa_id,categorias_financieras(nombre)")
        .in("empresa_id", companyIds)
        .order("fecha_gasto", { ascending: false })
        .limit(80),
      supabase
        .from("obligaciones_fiscales")
        .select("id,empresa_id,nombre,periodicidad,descripcion,activa")
        .in("empresa_id", companyIds)
        .eq("activa", true),
    ])
    : [
      { data: [] as IncomeRow[], error: null },
      { data: [] as ExpenseRow[], error: null },
      { data: [] as ObligationRow[], error: null },
    ];

  const incomes = (incomeResult.data ?? []) as IncomeRow[];
  const expenses = (expenseResult.data ?? []) as ExpenseRow[];
  const obligations = (obligationResult.data ?? []) as ObligationRow[];
  const currentMonthIncome = incomes
    .filter((income) => income.fecha_ingreso && income.fecha_ingreso >= monthStart)
    .reduce((sum, income) => sum + asNumber(income.monto), 0);

  const movements: CentroFiscalInitialData["movements"] = [
    ...incomes.map((income) => ({
      amount: asNumber(income.monto),
      category: firstRelation(income.categorias_financieras)?.nombre || "Ingresos",
      date: income.fecha_ingreso || "",
      description: income.concepto || "Ingreso registrado",
      id: `income-${income.id}`,
      status: "Registrado" as const,
      type: "Ingreso" as const,
    })),
    ...expenses.map((expense) => ({
      amount: asNumber(expense.monto),
      category: firstRelation(expense.categorias_financieras)?.nombre || "Gastos",
      date: expense.fecha_gasto || "",
      description: expense.concepto || "Gasto registrado",
      id: `expense-${expense.id}`,
      status: "Pagado" as const,
      type: "Gasto" as const,
    })),
  ].filter((movement) => movement.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 24);

  const docs: CentroFiscalInitialData["docs"] = movements.slice(0, 8).map((movement) => ({
    amount: movement.amount,
    id: `doc-${movement.id}`,
    subtitle: `${movement.category} · ${movement.date}`,
    title: movement.description,
    tone: movement.type === "Ingreso" ? "positive" : "negative",
  }));

  const events: CentroFiscalInitialData["events"] = obligations.map((obligation, index) => {
    const dueDate = new Date(now.getFullYear(), now.getMonth(), [17, 20, 25, 30][index % 4]);
    const diff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      day: dueDate.getDate(),
      dueIn: diff >= 0 ? `vence en ${diff} días` : "requiere revisión",
      id: obligation.id,
      month: dueDate.getMonth(),
      status: "Pendiente" as const,
      title: obligation.nombre || "Obligación fiscal",
      year: dueDate.getFullYear(),
    };
  });

  const taxes: CentroFiscalInitialData["taxes"] = obligations.map((obligation, index) => {
    const dueDate = new Date(now.getFullYear(), now.getMonth(), [17, 20, 25, 30][index % 4]);
    const name = obligation.nombre || "Impuesto por determinar";

    return {
      amount: taxEstimate(name, currentMonthIncome),
      dueDate: dateKey(dueDate),
      id: `tax-${obligation.id}`,
      name,
    };
  });

  return (
    <AppShell activeHref="/centro-fiscal" user={user}>
      <CentroFiscalHub
        initialData={{ docs, events, movements, taxes }}
        serverNow={now.toISOString()}
      />
    </AppShell>
  );
}
