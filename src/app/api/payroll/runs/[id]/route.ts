import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getAuthorizedPayrollRun,
  isMissingPayrollTable,
  mapPayrollRunRow,
  PAYROLL_SCHEMA_MESSAGE,
  readText,
} from "@/lib/payroll";
import { supabase } from "@/lib/supabase";

type PayrollRunUpdateBody = {
  downloaded?: unknown;
  status?: unknown;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const runResult = await getAuthorizedPayrollRun(user, id);
  if ("error" in runResult) {
    return NextResponse.json({ success: false, message: runResult.error }, { status: runResult.status });
  }

  let body: PayrollRunUpdateBody;
  try {
    body = (await request.json()) as PayrollRunUpdateBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const payload: { descargado?: boolean; estado?: string } = {};

  if ("downloaded" in body) {
    payload.descargado = Boolean(body.downloaded);
  }

  if ("status" in body) {
    const status = readText(body.status);
    if (!["Borrador", "Pagado"].includes(status)) {
      return NextResponse.json({ success: false, message: "Estado de nómina inválido." }, { status: 400 });
    }
    payload.estado = status === "Borrador" ? "borrador" : "pagado";
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ success: false, message: "No hay cambios para guardar." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("nominas")
    .update(payload)
    .eq("id", runResult.run.id)
    .select("id,folio,periodo,fecha_pago,empleados,percepciones,deducciones,total_pagado,estado,descargado")
    .single();

  if (isMissingPayrollTable(error)) {
    return NextResponse.json({ success: false, message: PAYROLL_SCHEMA_MESSAGE }, { status: 500 });
  }
  if (error || !data) {
    return NextResponse.json({ success: false, message: "No fue posible actualizar la nómina." }, { status: 500 });
  }

  return NextResponse.json({
    message: "Nómina actualizada correctamente.",
    run: mapPayrollRunRow(data, data.empleados ?? 0, data.periodo ?? ""),
    success: true,
  });
}
