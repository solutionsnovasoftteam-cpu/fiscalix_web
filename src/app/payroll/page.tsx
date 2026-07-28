import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import {
  getPrimaryPayrollCompanyId,
  isMissingPayrollTable,
  mapEmployeeRow,
  mapPayrollRunRow,
  PAYROLL_SCHEMA_MESSAGE,
  type PayrollEmployeeRow,
  type PayrollRunRow,
} from "@/lib/payroll";
import { supabase } from "@/lib/supabase";
import { defaultUserPreferences } from "@/lib/userPreferences.shared";
import { getQuincenaByOffset } from "@/app/payroll/payroll-dates";
import { PayrollHub, type PayrollHubInitialData } from "@/app/payroll/payroll-hub";

export default async function PayrollPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const preferences = user.preferences ?? defaultUserPreferences;

  const { companyId, error: companyError } = await getPrimaryPayrollCompanyId(user);
  let initialData: PayrollHubInitialData | undefined;
  let databaseStatusMessage = "";

  if (companyError) {
    databaseStatusMessage = "No fue posible consultar la empresa ligada a tu usuario.";
  } else if (!companyId) {
    databaseStatusMessage = "No hay una empresa ligada a tu perfil para registrar empleados.";
  }

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

    if (isMissingPayrollTable(employeesResult.error) || isMissingPayrollTable(payrollsResult.error)) {
      databaseStatusMessage = PAYROLL_SCHEMA_MESSAGE;
    } else if (employeesResult.error || payrollsResult.error) {
      databaseStatusMessage = "No fue posible cargar empleados o nóminas desde Supabase.";
    } else {
      const employees = ((employeesResult.data ?? []) as PayrollEmployeeRow[]).map(mapEmployeeRow);

      const fallbackCycle = getQuincenaByOffset(0);
      const history = ((payrollsResult.data ?? []) as PayrollRunRow[]).map((run) =>
        mapPayrollRunRow(run, employees.length, fallbackCycle.period),
      );

      initialData = { employees, history };
    }
  }

  return (
    <AppShell activeHref="/payroll" user={user}>
      <PayrollHub databaseStatusMessage={databaseStatusMessage} initialData={initialData} preferences={preferences} />
    </AppShell>
  );
}
