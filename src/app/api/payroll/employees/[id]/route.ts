import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getAuthorizedEmployee,
  isMissingPayrollTable,
  mapEmployeeRow,
  PAYROLL_SCHEMA_MESSAGE,
  readText,
} from "@/lib/payroll";
import { supabase } from "@/lib/supabase";

type EmployeeUpdateBody = {
  department?: unknown;
  name?: unknown;
  role?: unknown;
  salary?: unknown;
  status?: unknown;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const employeeResult = await getAuthorizedEmployee(user, id);
  if ("error" in employeeResult) {
    return NextResponse.json({ success: false, message: employeeResult.error }, { status: employeeResult.status });
  }

  let body: EmployeeUpdateBody;
  try {
    body = (await request.json()) as EmployeeUpdateBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const payload: {
    departamento?: string;
    estado?: string;
    nombre?: string;
    puesto?: string;
    sueldo_mensual?: number;
  } = {};

  if ("name" in body) {
    const name = readText(body.name);
    if (!name || name.length > 180) {
      return NextResponse.json({ success: false, message: "Ingresa un nombre válido." }, { status: 400 });
    }
    payload.nombre = name;
  }

  if ("role" in body) {
    const role = readText(body.role) || "Colaborador";
    if (role.length > 160) {
      return NextResponse.json({ success: false, message: "Puesto demasiado largo." }, { status: 400 });
    }
    payload.puesto = role;
  }

  if ("department" in body) {
    const department = readText(body.department) || "General";
    if (department.length > 160) {
      return NextResponse.json({ success: false, message: "Departamento demasiado largo." }, { status: 400 });
    }
    payload.departamento = department;
  }

  if ("salary" in body) {
    const salary = typeof body.salary === "number" ? body.salary : Number(readText(body.salary));
    if (!Number.isFinite(salary) || salary <= 0) {
      return NextResponse.json({ success: false, message: "Ingresa un sueldo válido mayor a cero." }, { status: 400 });
    }
    payload.sueldo_mensual = salary;
  }

  if ("status" in body) {
    const status = readText(body.status).toLowerCase();
    if (!["activo", "baja"].includes(status)) {
      return NextResponse.json({ success: false, message: "Estado de empleado inválido." }, { status: 400 });
    }
    payload.estado = status;
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ success: false, message: "No hay cambios para guardar." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("empleados_nomina")
    .update(payload)
    .eq("id", employeeResult.employee.id)
    .select("id,nombre,puesto,departamento,sueldo_mensual,estado")
    .single();

  if (isMissingPayrollTable(error)) {
    return NextResponse.json({ success: false, message: PAYROLL_SCHEMA_MESSAGE }, { status: 500 });
  }
  if (error || !data) {
    return NextResponse.json({ success: false, message: "No fue posible actualizar el empleado." }, { status: 500 });
  }

  return NextResponse.json({
    employee: mapEmployeeRow(data),
    message: "Empleado actualizado correctamente.",
    success: true,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const employeeResult = await getAuthorizedEmployee(user, id);
  if ("error" in employeeResult) {
    return NextResponse.json({ success: false, message: employeeResult.error }, { status: employeeResult.status });
  }

  const { error } = await supabase
    .from("empleados_nomina")
    .delete()
    .eq("id", employeeResult.employee.id);

  if (isMissingPayrollTable(error)) {
    return NextResponse.json({ success: false, message: PAYROLL_SCHEMA_MESSAGE }, { status: 500 });
  }
  if (error) {
    return NextResponse.json({ success: false, message: "No fue posible eliminar el empleado." }, { status: 500 });
  }

  return NextResponse.json({ message: "Empleado eliminado correctamente.", success: true });
}
