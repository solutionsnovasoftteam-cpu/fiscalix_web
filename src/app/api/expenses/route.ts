import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCompanyIfAccessible } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import {
  booleanFromFormValue,
  isMissingMovementNormalizationColumn,
  normalizeMovementStatus,
  normalizeTaxRate,
  taxAmountFromRate,
} from "@/lib/financialMovements";
import { createFinancialRecordNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

type ExpenseRequestBody = {
  categoriaId?: unknown;
  concepto?: unknown;
  deducible?: unknown;
  empresaId?: unknown;
  estado?: unknown;
  fechaGasto?: unknown;
  ivaTasa?: unknown;
  monto?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isExpenseCategoryType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  return ["gasto", "gastos", "egreso", "egresos", "expense", "expenses"].includes(normalized);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  let body: ExpenseRequestBody;
  try {
    body = (await request.json()) as ExpenseRequestBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const concepto = readText(body.concepto);
  const empresaId = readText(body.empresaId);
  const fechaGasto = readText(body.fechaGasto);
  const categoriaId = readText(body.categoriaId);
  const monto = typeof body.monto === "number" ? body.monto : Number(readText(body.monto));
  const deducible = booleanFromFormValue(body.deducible, true);
  const estado = normalizeMovementStatus(body.estado, "expense");
  const ivaTasa = normalizeTaxRate(body.ivaTasa);

  if (!empresaId || empresaId.length > 80) {
    return NextResponse.json({ success: false, message: "Selecciona una empresa válida." }, { status: 400 });
  }
  if (empresaId === "__other__") {
    return NextResponse.json({ success: false, message: "Selecciona una empresa registrada para normalizar el gasto." }, { status: 400 });
  }
  if (!concepto || concepto.length > 180) {
    return NextResponse.json({ success: false, message: "Ingresa una descripción válida." }, { status: 400 });
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ success: false, message: "Ingresa un monto mayor a cero." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaGasto)) {
    return NextResponse.json({ success: false, message: "Selecciona una fecha válida." }, { status: 400 });
  }
  if (!categoriaId) {
    return NextResponse.json({ success: false, message: "Selecciona una categoría para el gasto." }, { status: 400 });
  }
  if (!estado) {
    return NextResponse.json({ success: false, message: "Selecciona un estado válido para el gasto." }, { status: 400 });
  }
  if (ivaTasa === null) {
    return NextResponse.json({ success: false, message: "La tasa de IVA debe estar entre 0% y 100%." }, { status: 400 });
  }

  const { data: category, error: categoryError } = await supabase
    .from("categorias_financieras")
    .select("id,tipo")
    .eq("id", categoriaId)
    .maybeSingle();

  if (categoryError || !category) {
    return NextResponse.json({ success: false, message: "La categoría seleccionada no existe." }, { status: 400 });
  }
  if (!isExpenseCategoryType(category.tipo)) {
    return NextResponse.json({ success: false, message: "Selecciona una categoría de gasto." }, { status: 400 });
  }

  const { company, error: accessError } = await getCompanyIfAccessible(user, empresaId);
  if (accessError) {
    return NextResponse.json({ success: false, message: "No fue posible validar la empresa seleccionada." }, { status: 500 });
  }
  if (!company) {
    return NextResponse.json({ success: false, message: "No tienes acceso a la empresa seleccionada." }, { status: 403 });
  }

  const baseFiscal = deducible ? monto : 0;
  const ivaMonto = deducible ? taxAmountFromRate(baseFiscal, ivaTasa) : 0;

  const { data, error } = await supabase
    .from("gastos")
    .insert({
      base_fiscal: baseFiscal,
      categoria_id: categoriaId,
      concepto,
      deducible,
      empresa_id: empresaId,
      estado,
      fecha_gasto: fechaGasto,
      id: randomUUID(),
      isr_retenido_monto: 0,
      iva_monto: ivaMonto,
      iva_tasa: ivaTasa,
      monto,
      usuario_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMissingMovementNormalizationColumn(error)) {
      return NextResponse.json(
        {
          success: false,
          message: "Falta normalizar la tabla gastos. Ejecuta el SQL scripts/financial-movements-stage-5.sql en Supabase.",
        },
        { status: 500 },
      );
    }
    const message = error?.message?.toLowerCase() ?? "";
    const details = error?.details?.toLowerCase() ?? "";
    if (message.includes("usuario_id") || details.includes("usuario_id")) {
      return NextResponse.json(
        {
          success: false,
          message: "Falta agregar la columna usuario_id en la tabla gastos. Ejecuta el SQL scripts/expenses-independent-schema.sql en Supabase.",
        },
        { status: 500 },
      );
    }
    if (error?.code === "42703") {
      return NextResponse.json(
        {
          success: false,
          message: "Falta actualizar el esquema de la tabla gastos. Ejecuta el SQL scripts/expenses-independent-schema.sql en Supabase.",
        },
        { status: 500 },
      );
    }
    if (error?.code === "23502" && (message.includes("empresa_id") || details.includes("empresa_id"))) {
      return NextResponse.json(
        {
          success: false,
          message: "La tabla gastos todavía obliga empresa_id. Ejecuta el SQL scripts/expenses-independent-schema.sql en Supabase.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: false, message: "No fue posible guardar el gasto." }, { status: 500 });
  }

  await createFinancialRecordNotification({
    actorUserId: user.id,
    amount: monto,
    companyId: empresaId,
    companyName: company.nombre_comercial || "Sin empresa",
    concept: concepto,
    kind: "expense",
  });

  return NextResponse.json({ success: true, message: "Gasto registrado correctamente.", data });
}
