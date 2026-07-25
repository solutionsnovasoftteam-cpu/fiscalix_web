import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  PAYROLL_SCHEMA_MESSAGE,
  getPayrollCompanyIdOrError,
  isMissingPayrollTable,
  mapEmployeeRow,
  readText,
} from "@/lib/payroll";
import { supabase } from "@/lib/supabase";

type EmployeeRequestBody = {
  department?: unknown;
  name?: unknown;
  role?: unknown;
  salary?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  let body: EmployeeRequestBody;
  try {
    body = (await request.json()) as EmployeeRequestBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const companyResult = await getPayrollCompanyIdOrError(user);
  if ("error" in companyResult) {
    return NextResponse.json({ success: false, message: companyResult.error }, { status: companyResult.status });
  }

  const name = readText(body.name);
  const role = readText(body.role) || "Colaborador";
  const department = readText(body.department) || "General";
  const salary = typeof body.salary === "number" ? body.salary : Number(readText(body.salary));

  if (!name || name.length > 180) {
    return NextResponse.json({ success: false, message: "Ingresa un nombre válido." }, { status: 400 });
  }
  if (role.length > 160 || department.length > 160) {
    return NextResponse.json({ success: false, message: "Puesto o departamento demasiado largo." }, { status: 400 });
  }
  if (!Number.isFinite(salary) || salary <= 0) {
    return NextResponse.json({ success: false, message: "Ingresa un sueldo válido mayor a cero." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("empleados_nomina")
    .insert({
      departamento: department,
      empresa_id: companyResult.companyId,
      estado: "activo",
      id: randomUUID(),
      nombre: name,
      puesto: role,
      sueldo_mensual: salary,
    })
    .select("id,nombre,puesto,departamento,sueldo_mensual,estado")
    .single();

  if (isMissingPayrollTable(error)) {
    return NextResponse.json({ success: false, message: PAYROLL_SCHEMA_MESSAGE }, { status: 500 });
  }
  if (error || !data) {
    return NextResponse.json({ success: false, message: "No fue posible guardar el empleado." }, { status: 500 });
  }

  return NextResponse.json({
    employee: mapEmployeeRow(data),
    message: "Empleado registrado correctamente.",
    success: true,
  });
}
