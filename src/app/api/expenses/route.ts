import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createFinancialRecordNotification } from "@/lib/notifications";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type ExpenseRequestBody = {
  categoriaId?: unknown;
  concepto?: unknown;
  empresaId?: unknown;
  empresaNombreOtro?: unknown;
  fechaGasto?: unknown;
  monto?: unknown;
};

const OTHER_COMPANY_VALUE = "__other__";

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isExpenseCategoryType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  return ["gasto", "gastos", "egreso", "egresos", "expense", "expenses"].includes(normalized);
}

async function getAllowedCompanyName(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, empresaId: string) {
  const { data: company, error: companyError } = await supabase
    .from("empresas")
    .select("id,nombre_comercial,estado")
    .eq("id", empresaId)
    .maybeSingle();

  if (companyError || !company || company.estado === "suspendida") return null;
  if (canViewAdminDashboard(user)) return company.nombre_comercial || "Sin empresa";

  const { data: membership, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  return !membershipError && membership ? company.nombre_comercial || "Sin empresa" : null;
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
  const empresaNombreOtro = readText(body.empresaNombreOtro);
  const fechaGasto = readText(body.fechaGasto);
  const categoriaId = readText(body.categoriaId) || null;
  const monto = typeof body.monto === "number" ? body.monto : Number(readText(body.monto));
  const isOtherCompany = empresaId === OTHER_COMPANY_VALUE;

  if (!empresaId || empresaId.length > 80) {
    return NextResponse.json({ success: false, message: "Selecciona una empresa válida." }, { status: 400 });
  }
  if (isOtherCompany && (!empresaNombreOtro || empresaNombreOtro.length > 120)) {
    return NextResponse.json({ success: false, message: "Ingresa el nombre de la empresa." }, { status: 400 });
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

  if (categoriaId) {
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
  }

  let selectedCompanyName = empresaNombreOtro || null;

  if (!isOtherCompany) {
    selectedCompanyName = await getAllowedCompanyName(user, empresaId);
    if (!selectedCompanyName) {
      return NextResponse.json({ success: false, message: "No tienes acceso a la empresa seleccionada." }, { status: 403 });
    }
  }

  const storedConcept = isOtherCompany ? [empresaNombreOtro, concepto].filter(Boolean).join(" · ") : concepto;

  const { data, error } = await supabase
    .from("gastos")
    .insert({
      categoria_id: categoriaId,
      concepto: storedConcept,
      empresa_id: isOtherCompany ? null : empresaId,
      fecha_gasto: fechaGasto,
      id: randomUUID(),
      monto,
      usuario_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
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
    companyId: isOtherCompany ? null : empresaId,
    companyName: selectedCompanyName,
    concept: concepto,
    kind: "expense",
  });

  return NextResponse.json({ success: true, message: "Gasto registrado correctamente.", data });
}
