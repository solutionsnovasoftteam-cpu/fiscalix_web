import { NextResponse } from "next/server";
import { getCompanyIfAccessible } from "@/lib/access-control";
import { getApiUser } from "@/lib/auth";
import { normalizeMoney, normalizeTaxRate, taxAmountFromRate } from "@/lib/financialMovements";
import { supabase } from "@/lib/supabase";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/income/[id]">,
) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const { data: current, error: currentError } = await supabase
    .from("ingresos")
    .select("id,empresa_id,monto,iva_tasa,isr_retenido_monto")
    .eq("id", id)
    .maybeSingle();

  if (currentError) return NextResponse.json({ success: false, message: "No fue posible consultar el ingreso." }, { status: 500 });
  if (!current) return NextResponse.json({ success: false, message: "Ingreso no encontrado." }, { status: 404 });

  const { company, error: accessError } = await getCompanyIfAccessible(user, current.empresa_id);
  if (accessError) return NextResponse.json({ success: false, message: "No fue posible validar la empresa." }, { status: 500 });
  if (!company) return NextResponse.json({ success: false, message: "No tienes acceso a este ingreso." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const values: Record<string, unknown> = {};
  const concepto = text(body.concepto);
  const fechaIngreso = text(body.fechaIngreso);
  const monto = body.monto === undefined ? Number(current.monto) : Number(body.monto);
  const categoriaId = text(body.categoriaId);
  const estado = text(body.estado);
  const ivaTasa = body.ivaTasa === undefined ? Number(current.iva_tasa ?? 0.16) : normalizeTaxRate(body.ivaTasa);
  const isrRetenido = body.isrRetenido === undefined ? Number(current.isr_retenido_monto ?? 0) : normalizeMoney(body.isrRetenido);

  if (body.concepto !== undefined) {
    if (!concepto || concepto.length > 180) return NextResponse.json({ success: false, message: "Ingresa una descripción válida." }, { status: 400 });
    values.concepto = concepto;
  }
  if (body.fechaIngreso !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) return NextResponse.json({ success: false, message: "Selecciona una fecha válida." }, { status: 400 });
    values.fecha_ingreso = fechaIngreso;
  }
  if (body.monto !== undefined) {
    if (!Number.isFinite(monto) || monto <= 0) return NextResponse.json({ success: false, message: "Ingresa un monto mayor a cero." }, { status: 400 });
    values.monto = monto;
  }
  if (body.categoriaId !== undefined) {
    if (!categoriaId) return NextResponse.json({ success: false, message: "Selecciona una categoría válida." }, { status: 400 });
    const { data: category } = await supabase.from("categorias_financieras").select("id,tipo").eq("id", categoriaId).maybeSingle();
    if (!category || !["ingreso", "ingresos", "income", "incomes", "revenue", "venta", "ventas"].includes(String(category.tipo).toLowerCase())) {
      return NextResponse.json({ success: false, message: "Selecciona una categoría de ingreso." }, { status: 400 });
    }
    values.categoria_id = categoriaId;
  }
  if (body.estado !== undefined) {
    if (!["cobrado", "pendiente", "cancelado"].includes(estado)) return NextResponse.json({ success: false, message: "Selecciona un estado válido." }, { status: 400 });
    values.estado = estado;
  }
  if (body.ivaTasa !== undefined) {
    if (ivaTasa === null) return NextResponse.json({ success: false, message: "La tasa de IVA no es válida." }, { status: 400 });
    values.iva_tasa = ivaTasa;
  }
  if (body.isrRetenido !== undefined) {
    if (isrRetenido === null || isrRetenido < 0 || isrRetenido > monto) return NextResponse.json({ success: false, message: "La retención de ISR no es válida." }, { status: 400 });
    values.isr_retenido_monto = isrRetenido;
  }

  if (Object.keys(values).length === 0) return NextResponse.json({ success: false, message: "No hay cambios para guardar." }, { status: 400 });
  if (ivaTasa === null) return NextResponse.json({ success: false, message: "La tasa de IVA no es válida." }, { status: 400 });
  values.base_fiscal = monto;
  values.iva_monto = taxAmountFromRate(monto, ivaTasa);

  const { data, error } = await supabase.from("ingresos").update(values).eq("id", id).select("id").single();
  if (error || !data) return NextResponse.json({ success: false, message: "No fue posible actualizar el ingreso." }, { status: 500 });
  return NextResponse.json({ success: true, message: "Ingreso actualizado correctamente.", data });
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/income/[id]">,
) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const { data: current, error: currentError } = await supabase.from("ingresos").select("id,empresa_id").eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ success: false, message: "No fue posible consultar el ingreso." }, { status: 500 });
  if (!current) return NextResponse.json({ success: false, message: "Ingreso no encontrado." }, { status: 404 });

  const { company, error: accessError } = await getCompanyIfAccessible(user, current.empresa_id);
  if (accessError) return NextResponse.json({ success: false, message: "No fue posible validar la empresa." }, { status: 500 });
  if (!company) return NextResponse.json({ success: false, message: "No tienes acceso a este ingreso." }, { status: 403 });

  const { error } = await supabase.from("ingresos").delete().eq("id", id);
  if (error) return NextResponse.json({ success: false, message: "No fue posible eliminar el ingreso." }, { status: 500 });
  return NextResponse.json({ success: true, message: "Ingreso eliminado correctamente." });
}
