import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getQuincenaByOffset, type PayrollRun } from "@/app/payroll/payroll-dates";
import { PayrollHub, type PayrollEmployee, type PayrollHubInitialData } from "@/app/payroll/payroll-hub";

type PayrollEmployeeRow = {
  departamento: string | null;
  estado: string | null;
  id: string;
  nombre: string | null;
  puesto: string | null;
  sueldo_mensual: number | string | null;
};

type PayrollRunRow = {
  deducciones: number | string | null;
  descargado: boolean | null;
  empleados: number | null;
  estado: string | null;
  fecha_pago: string | null;
  folio: string | null;
  id: string;
  percepciones: number | string | null;
  periodo: string | null;
  total_pagado: number | string | null;
};

function initialsFrom(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return text.includes("pgrst205") || text.includes("schema cache");
}

async function getPrimaryCompanyId(userId: string) {
  const { data } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", userId)
    .limit(1);

  return data?.[0]?.empresa_id ?? null;
}

export default async function PayrollPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyId = await getPrimaryCompanyId(user.id);
  let initialData: PayrollHubInitialData | undefined;

  if (companyId) {
    const [employeesResult, payrollsResult] = await Promise.all([
      supabase
        .from("empleados_nomina")
        .select("id,nombre,puesto,departamento,sueldo_mensual,estado")
        .eq("empresa_id", companyId)
        .order("nombre", { ascending: true }),
      supabase
        .from("nominas")
        .select("id,folio,periodo,fecha_pago,empleados,percepciones,deducciones,total_pagado,estado,descargado")
        .eq("empresa_id", companyId)
        .order("fecha_pago", { ascending: false }),
    ]);

    if (!isMissingTable(employeesResult.error) && !isMissingTable(payrollsResult.error)) {
      const employees = ((employeesResult.data ?? []) as PayrollEmployeeRow[]).map<PayrollEmployee>((employee) => {
        const name = employee.nombre || "Empleado";

        return {
          department: employee.departamento || "General",
          id: employee.id,
          initials: initialsFrom(name),
          name,
          role: employee.puesto || "Colaborador",
          salary: asNumber(employee.sueldo_mensual),
          status: employee.estado === "baja" ? "Baja" : "Activo",
        };
      });

      const fallbackCycle = getQuincenaByOffset(0);
      const history = ((payrollsResult.data ?? []) as PayrollRunRow[]).map<PayrollRun>((run) => ({
        deductions: asNumber(run.deducciones),
        downloaded: Boolean(run.descargado),
        employees: run.empleados ?? employees.length,
        folio: run.folio || `NOM-${run.id.slice(0, 8).toUpperCase()}`,
        id: run.id,
        paid: asNumber(run.total_pagado),
        payDate: run.fecha_pago || new Date().toISOString().slice(0, 10),
        perceptions: asNumber(run.percepciones),
        period: run.periodo || fallbackCycle.period,
        status: run.estado === "borrador" ? "Borrador" : "Pagado",
      }));

      initialData = { employees, history };
    }
  }

  return (
    <AppShell activeHref="/payroll" user={user}>
      <PayrollHub initialData={initialData} />
    </AppShell>
  );
}
