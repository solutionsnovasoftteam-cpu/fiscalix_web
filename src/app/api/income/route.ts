import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createFinancialRecordNotification } from "@/lib/notifications";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type IncomeRequestBody = {
  categoriaId?: unknown;
  concepto?: unknown;
  empresaId?: unknown;
  empresaNombreOtro?: unknown;
  fechaIngreso?: unknown;
  monto?: unknown;
};

const OTHER_COMPANY_VALUE = "__other__";

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isIncomeCategoryType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  return ["ingreso", "ingresos", "income", "incomes", "revenue", "venta", "ventas"].includes(normalized);
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

  let body: IncomeRequestBody;
  try {
    body = (await request.json()) as IncomeRequestBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const concepto = readText(body.concepto);
  const empresaId = readText(body.empresaId);
  const empresaNombreOtro = readText(body.empresaNombreOtro);
  const fechaIngreso = readText(body.fechaIngreso);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
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
    if (!isIncomeCategoryType(category.tipo)) {
      return NextResponse.json({ success: false, message: "Selecciona una categoría de ingreso." }, { status: 400 });
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
    .from("ingresos")
    .insert({
      categoria_id: categoriaId,
      concepto: storedConcept,
      empresa_id: isOtherCompany ? null : empresaId,
      fecha_ingreso: fechaIngreso,
      id: randomUUID(),
      monto,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, message: "No fue posible guardar el ingreso." }, { status: 500 });
  }

  await createFinancialRecordNotification({
    actorUserId: user.id,
    amount: monto,
    companyId: isOtherCompany ? null : empresaId,
    companyName: selectedCompanyName,
    concept: concepto,
    kind: "income",
  });

  return NextResponse.json({ success: true, message: "Ingreso registrado correctamente.", data });
}
