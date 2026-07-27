import "server-only";

import { canAccessCompany, getPrimaryAccessibleCompany } from "@/lib/access-control";
import { supabase } from "@/lib/supabase";
import type { getCurrentUser } from "@/lib/auth";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export type PayrollEmployeeRow = {
  departamento: string | null;
  estado: string | null;
  id: string;
  nombre: string | null;
  puesto: string | null;
  sueldo_mensual: number | string | null;
};

export type PayrollRunRow = {
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

export const PAYROLL_SCHEMA_MESSAGE =
  "Faltan las tablas de nómina en Supabase. Ejecuta scripts/create-payroll-demo-tables.sql en el SQL Editor.";

export function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function initialsFrom(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function isMissingPayrollTable(error: { code?: string; message?: string } | null | undefined) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return text.includes("pgrst205") || text.includes("schema cache") || text.includes("does not exist") || text.includes("42p01");
}

export function mapEmployeeRow(employee: PayrollEmployeeRow) {
  const name = employee.nombre || "Empleado";

  return {
    department: employee.departamento || "General",
    id: employee.id,
    initials: initialsFrom(name),
    name,
    role: employee.puesto || "Colaborador",
    salary: asNumber(employee.sueldo_mensual),
    status: employee.estado === "baja" ? "Baja" as const : "Activo" as const,
  };
}

export function mapPayrollRunRow(run: PayrollRunRow, employeeCount: number, fallbackPeriod: string) {
  return {
    deductions: asNumber(run.deducciones),
    downloaded: Boolean(run.descargado),
    employees: run.empleados ?? employeeCount,
    folio: run.folio || `NOM-${run.id.slice(0, 8).toUpperCase()}`,
    id: run.id,
    paid: asNumber(run.total_pagado),
    payDate: run.fecha_pago || new Date().toISOString().slice(0, 10),
    perceptions: asNumber(run.percepciones),
    period: run.periodo || fallbackPeriod,
    status: run.estado === "borrador" ? "Borrador" as const : "Pagado" as const,
  };
}

export async function getPrimaryPayrollCompanyId(user: CurrentUser) {
  const { company, error } = await getPrimaryAccessibleCompany(user);

  if (error) return { companyId: null, error };
  return { companyId: company?.id ?? null, error: null };
}

export async function canAccessPayrollCompany(user: CurrentUser, companyId: string) {
  const { allowed } = await canAccessCompany(user, companyId);
  return allowed;
}

export async function getPayrollCompanyIdOrError(user: CurrentUser) {
  const { companyId, error } = await getPrimaryPayrollCompanyId(user);

  if (error) return { error: "No fue posible consultar la empresa del usuario.", status: 500 as const };
  if (!companyId) return { error: "No hay una empresa ligada a tu perfil para registrar nómina.", status: 400 as const };

  return { companyId };
}

export async function getAuthorizedEmployee(user: CurrentUser, employeeId: string) {
  const { data: employee, error } = await supabase
    .from("empleados_nomina")
    .select("id,empresa_id,nombre,puesto,departamento,sueldo_mensual,estado")
    .eq("id", employeeId)
    .maybeSingle();

  if (isMissingPayrollTable(error)) return { error: PAYROLL_SCHEMA_MESSAGE, status: 500 as const };
  if (error) return { error: "No fue posible consultar el empleado.", status: 500 as const };
  if (!employee) return { error: "Empleado no encontrado.", status: 404 as const };

  const allowed = await canAccessPayrollCompany(user, employee.empresa_id);
  if (!allowed) return { error: "No tienes acceso a este empleado.", status: 403 as const };

  return { employee };
}

export async function getAuthorizedPayrollRun(user: CurrentUser, runId: string) {
  const { data: run, error } = await supabase
    .from("nominas")
    .select("id,empresa_id")
    .eq("id", runId)
    .maybeSingle();

  if (isMissingPayrollTable(error)) return { error: PAYROLL_SCHEMA_MESSAGE, status: 500 as const };
  if (error) return { error: "No fue posible consultar la nómina.", status: 500 as const };
  if (!run) return { error: "Nómina no encontrada.", status: 404 as const };

  const allowed = await canAccessPayrollCompany(user, run.empresa_id);
  if (!allowed) return { error: "No tienes acceso a esta nómina.", status: 403 as const };

  return { run };
}
