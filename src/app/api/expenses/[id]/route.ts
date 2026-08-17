import { NextResponse } from "next/server";
import { getCompanyIfAccessible } from "@/lib/access-control";
import { getApiUser } from "@/lib/auth";
import { booleanFromFormValue, normalizeTaxRate, taxAmountFromRate } from "@/lib/financialMovements";
import { supabase } from "@/lib/supabase";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const expenseTypes = new Set(["gasto", "gastos", "egreso", "egresos", "expense", "expenses"]);

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/expenses/[id]">,
) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const { data: current, error: currentError } = await supabase
    .from("gastos")
    .select("id,empresa_id,monto,iva_tasa,deducible")
    .eq("id", id)
    .maybeSingle();

  if (currentError) return NextResponse.json({ success: false, message: "No fue posible consultar el gasto." }, { status: 500 });
  if (!current) return NextResponse.json({ success: false, message: "Gasto no encontrado." }, { status: 404 });

  const { company, error: accessError } = await getCompanyIfAccessible(user, current.empresa_id);
  if (accessError) return NextResponse.json({ success: false, message: "No fue posible validar la empresa." }, { status: 500 });
  if (!company) return NextResponse.json({ success: false, message: "No tienes acceso a este gasto." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const values: Record<string, unknown> = {};
  const concepto = text(body.concepto);
  const fechaGasto = text(body.fechaGasto);
  const monto = body.monto === undefined ? Number(current.monto) : Number(body.monto);
  const categoriaId = text(body.categoriaId);
  const estado = text(body.estado);
  const deducible = body.deducible === undefined ? Boolean(current.deducible) : booleanFromFormValue(body.deducible, true);
  const ivaTasa = body.ivaTasa === undefined ? Number(current.iva_tasa ?? 0.16) : normalizeTaxRate(body.ivaTasa);

  if (body.concepto !== undefined) {
    if (!concepto || concepto.length > 180) return NextResponse.json({ success: false, message: "Ingresa una descripción válida." }, { status: 400 });
    values.concepto = concepto;
  }
  if (body.fechaGasto !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaGasto)) return NextResponse.json({ success: false, message: "Selecciona una fecha válida." }, { status: 400 });
    values.fecha_gasto = fechaGasto;
  }
  if (body.monto !== undefined) {
    if (!Number.isFinite(monto) || monto <= 0) return NextResponse.json({ success: false, message: "Ingresa un monto mayor a cero." }, { status: 400 });
    values.monto = monto;
  }
  if (body.categoriaId !== undefined) {
    if (!categoriaId) return NextResponse.json({ success: false, message: "Selecciona una categoría válida." }, { status: 400 });
    const { data: category } = await supabase.from("categorias_financieras").select("id,tipo").eq("id", categoriaId).maybeSingle();
    if (!category || !expenseTypes.has(String(category.tipo).toLowerCase())) {
      return NextResponse.json({ success: false, message: "Selecciona una categoría de gasto." }, { status: 400 });
    }
    values.categoria_id = categoriaId;
  }
  if (body.estado !== undefined) {
    if (!["pagado", "pendiente", "cancelado"].includes(estado)) return NextResponse.json({ success: false, message: "Selecciona un estado válido." }, { status: 400 });
    values.estado = estado;
  }
  if (body.deducible !== undefined) values.deducible = deducible;
  if (body.ivaTasa !== undefined) {
    if (ivaTasa === null) return NextResponse.json({ success: false, message: "La tasa de IVA no es válida." }, { status: 400 });
    values.iva_tasa = ivaTasa;
  }

  if (Object.keys(values).length === 0) return NextResponse.json({ success: false, message: "No hay cambios para guardar." }, { status: 400 });
  if (ivaTasa === null) return NextResponse.json({ success: false, message: "La tasa de IVA no es válida." }, { status: 400 });
  values.base_fiscal = deducible ? monto : 0;
  values.iva_monto = deducible ? taxAmountFromRate(monto, ivaTasa) : 0;

  const { data, error } = await supabase.from("gastos").update(values).eq("id", id).select("id").single();
  if (error || !data) return NextResponse.json({ success: false, message: "No fue posible actualizar el gasto." }, { status: 500 });
  return NextResponse.json({ success: true, message: "Gasto actualizado correctamente.", data });
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/expenses/[id]">,
) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const { data: current, error: currentError } = await supabase.from("gastos").select("id,empresa_id").eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ success: false, message: "No fue posible consultar el gasto." }, { status: 500 });
  if (!current) return NextResponse.json({ success: false, message: "Gasto no encontrado." }, { status: 404 });

  const { company, error: accessError } = await getCompanyIfAccessible(user, current.empresa_id);
  if (accessError) return NextResponse.json({ success: false, message: "No fue posible validar la empresa." }, { status: 500 });
  if (!company) return NextResponse.json({ success: false, message: "No tienes acceso a este gasto." }, { status: 403 });

  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) return NextResponse.json({ success: false, message: "No fue posible eliminar el gasto." }, { status: 500 });
  return NextResponse.json({ success: true, message: "Gasto eliminado correctamente." });
}
