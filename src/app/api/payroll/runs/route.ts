import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getPayrollCompanyIdOrError,
  isMissingPayrollTable,
  mapPayrollRunRow,
  PAYROLL_SCHEMA_MESSAGE,
  readText,
} from "@/lib/payroll";
import { supabase } from "@/lib/supabase";

type PayrollRunRequestBody = {
  deductions?: unknown;
  employees?: unknown;
  folio?: unknown;
  paid?: unknown;
  payDate?: unknown;
  perceptions?: unknown;
  period?: unknown;
  status?: unknown;
};

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(readText(value));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  let body: PayrollRunRequestBody;
  try {
    body = (await request.json()) as PayrollRunRequestBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const companyResult = await getPayrollCompanyIdOrError(user);
  if ("error" in companyResult) {
    return NextResponse.json({ success: false, message: companyResult.error }, { status: companyResult.status });
  }

  const folio = readText(body.folio);
  const period = readText(body.period);
  const payDate = readText(body.payDate);
  const employees = readNumber(body.employees);
  const perceptions = readNumber(body.perceptions);
  const deductions = readNumber(body.deductions);
  const paid = readNumber(body.paid);
  const status = readText(body.status) === "Borrador" ? "borrador" : "pagado";

  if (!folio || folio.length > 120) {
    return NextResponse.json({ success: false, message: "Folio de nómina inválido." }, { status: 400 });
  }
  if (!period || period.length > 180) {
    return NextResponse.json({ success: false, message: "Periodo de nómina inválido." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) {
    return NextResponse.json({ success: false, message: "Fecha de pago inválida." }, { status: 400 });
  }
  if (![employees, perceptions, deductions, paid].every((value) => Number.isFinite(value) && value >= 0)) {
    return NextResponse.json({ success: false, message: "Montos de nómina inválidos." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("nominas")
    .insert({
      deducciones: deductions,
      descargado: false,
      empleados: employees,
      empresa_id: companyResult.companyId,
      estado: status,
      fecha_pago: payDate,
      folio,
      id: randomUUID(),
      percepciones: perceptions,
      periodo: period,
      total_pagado: paid,
    })
    .select("id,folio,periodo,fecha_pago,empleados,percepciones,deducciones,total_pagado,estado,descargado")
    .single();

  if (isMissingPayrollTable(error)) {
    return NextResponse.json({ success: false, message: PAYROLL_SCHEMA_MESSAGE }, { status: 500 });
  }
  if (error || !data) {
    return NextResponse.json({ success: false, message: "No fue posible guardar la nómina." }, { status: 500 });
  }

  return NextResponse.json({
    message: status === "borrador" ? "Borrador de nómina creado." : "Nómina generada correctamente.",
    run: mapPayrollRunRow(data, employees, period),
    success: true,
  });
}
