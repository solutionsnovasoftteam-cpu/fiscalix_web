import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCompanyIfAccessible, isMissingColumnError } from "@/lib/access-control";
import { getApiUser } from "@/lib/auth";
import {
  isMissingMovementNormalizationColumn,
  normalizeMoney,
  normalizeMovementStatus,
  normalizeTaxRate,
  taxAmountFromRate,
} from "@/lib/financialMovements";
import { createFinancialRecordNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

type IncomeRequestBody = {
  categoriaId?: unknown;
  concepto?: unknown;
  empresaId?: unknown;
  estado?: unknown;
  fechaIngreso?: unknown;
  isrRetenido?: unknown;
  ivaTasa?: unknown;
  monto?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isIncomeCategoryType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  return ["ingreso", "ingresos", "income", "incomes", "revenue", "venta", "ventas"].includes(normalized);
}

function readLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

function categoryName(value: unknown) {
  const category = Array.isArray(value) ? value[0] : value;
  return category && typeof category === "object" && "nombre" in category
    ? String(category.nombre ?? "")
    : "";
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const empresaId = readText(url.searchParams.get("companyId"));
  if (!empresaId) {
    return NextResponse.json({ success: false, message: "Selecciona una empresa válida." }, { status: 400 });
  }

  const { company, error: accessError } = await getCompanyIfAccessible(user, empresaId);
  if (accessError) {
    return NextResponse.json({ success: false, message: "No fue posible validar la empresa seleccionada." }, { status: 500 });
  }
  if (!company) {
    return NextResponse.json({ success: false, message: "No tienes acceso a la empresa seleccionada." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("ingresos")
    .select("id,concepto,monto,fecha_ingreso,estado,deducible,empresa_id,categoria_id,categorias_financieras(nombre)")
    .eq("empresa_id", empresaId)
    .order("fecha_ingreso", { ascending: false })
    .limit(readLimit(url.searchParams.get("limit")));

  if (error) {
    return NextResponse.json({ success: false, message: "No fue posible consultar los ingresos." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      incomes: (data ?? []).map((income) => ({
        id: income.id,
        companyId: income.empresa_id,
        type: "income",
        amount: Number(income.monto) || 0,
        date: income.fecha_ingreso,
        category: categoryName(income.categorias_financieras),
        categoryId: income.categoria_id,
        description: income.concepto,
        status: income.estado,
        deductible: Boolean(income.deducible),
      })),
    },
  });
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  let body: IncomeRequestBody;
  try {
    body = (await request.json()) as IncomeRequestBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const concepto = readText(body.concepto);
  const empresaId = readText(body.empresaId);
  const fechaIngreso = readText(body.fechaIngreso);
  const categoriaId = readText(body.categoriaId);
  const monto = typeof body.monto === "number" ? body.monto : Number(readText(body.monto));
  const estado = normalizeMovementStatus(body.estado, "income");
  const ivaTasa = normalizeTaxRate(body.ivaTasa);
  const isrRetenido = normalizeMoney(body.isrRetenido ?? 0);

  if (!empresaId || empresaId.length > 80) {
    return NextResponse.json({ success: false, message: "Selecciona una empresa válida." }, { status: 400 });
  }
  if (empresaId === "__other__") {
    return NextResponse.json({ success: false, message: "Selecciona una empresa registrada para normalizar el ingreso." }, { status: 400 });
  }
  if (!concepto || concepto.length > 180) {
    return NextResponse.json({ success: false, message: "Ingresa una descripción válida." }, { status: 400 });
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ success: false, message: "Ingresa un monto mayor a cero." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
    return NextResponse.json({ success: false, message: "Selecciona una fecha válida." }, { status: 400 });
  }
  if (!categoriaId) {
    return NextResponse.json({ success: false, message: "Selecciona una categoría para el ingreso." }, { status: 400 });
  }
  if (!estado) {
    return NextResponse.json({ success: false, message: "Selecciona un estado válido para el ingreso." }, { status: 400 });
  }
  if (ivaTasa === null) {
    return NextResponse.json({ success: false, message: "La tasa de IVA debe estar entre 0% y 100%." }, { status: 400 });
  }
  if (isrRetenido === null || isrRetenido < 0 || isrRetenido > monto) {
    return NextResponse.json({ success: false, message: "Ingresa una retención de ISR válida." }, { status: 400 });
  }

  const { data: category, error: categoryError } = await supabase
    .from("categorias_financieras")
    .select("id,tipo")
    .eq("id", categoriaId)
    .maybeSingle();

  if (categoryError || !category) {
    return NextResponse.json({ success: false, message: "La categoría seleccionada no existe." }, { status: 400 });
  }
  if (!isIncomeCategoryType(category.tipo)) {
    return NextResponse.json({ success: false, message: "Selecciona una categoría de ingreso." }, { status: 400 });
  }

  const { company, error: accessError } = await getCompanyIfAccessible(user, empresaId);
  if (accessError) {
    return NextResponse.json({ success: false, message: "No fue posible validar la empresa seleccionada." }, { status: 500 });
  }
  if (!company) {
    return NextResponse.json({ success: false, message: "No tienes acceso a la empresa seleccionada." }, { status: 403 });
  }

  const baseFiscal = monto;
  const ivaMonto = taxAmountFromRate(baseFiscal, ivaTasa);

  const { data, error } = await supabase
    .from("ingresos")
    .insert({
      base_fiscal: baseFiscal,
      categoria_id: categoriaId,
      concepto,
      deducible: false,
      empresa_id: empresaId,
      estado,
      fecha_ingreso: fechaIngreso,
      id: randomUUID(),
      isr_retenido_monto: isrRetenido,
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
          message: "Falta normalizar la tabla ingresos. Ejecuta el SQL scripts/financial-movements-stage-5.sql en Supabase.",
        },
        { status: 500 },
      );
    }
    if (isMissingColumnError(error, "usuario_id")) {
      return NextResponse.json(
        {
          success: false,
          message: "Falta agregar la columna usuario_id en la tabla ingresos. Ejecuta el SQL scripts/income-independent-schema.sql en Supabase.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: false, message: "No fue posible guardar el ingreso." }, { status: 500 });
  }

  await createFinancialRecordNotification({
    actorUserId: user.id,
    amount: monto,
    companyId: empresaId,
    companyName: company.nombre_comercial || "Sin empresa",
    concept: concepto,
    kind: "income",
  });

  return NextResponse.json({ success: true, message: "Ingreso registrado correctamente.", data });
}
