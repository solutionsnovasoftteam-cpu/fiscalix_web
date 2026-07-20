import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { basicPlanSelect, extendedPlanSelect, isMissingPlanColumnError, type PlanDbRow } from "@/lib/plans";
import { canManagePlans } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type PlanPayload = {
  annualAmount?: number | null;
  badge?: string | null;
  companyLimit?: number | null;
  databaseId?: string;
  description?: string | null;
  includes?: string[];
  limits?: string[];
  monthlyAmount?: number;
  name?: string;
  objective?: string | null;
  order?: number | null;
  status?: string | null;
  userLimit?: number | null;
};

type PlanMutationResult = {
  data: PlanDbRow | null;
  error: { code?: string; details?: string; message: string } | null;
};

function cleanLimit(value: unknown) {
  if (value === null || value === "" || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function cleanPrice(value: unknown) {
  if (value === null || value === "" || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function cleanTextArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  if (!canManagePlans(user)) {
    return NextResponse.json({ message: "Solo el superadministrador puede editar planes." }, { status: 403 });
  }

  const body = (await request.json()) as PlanPayload;
  const nombre = typeof body.name === "string" ? body.name.trim() : "";
  const precioMensual = cleanPrice(body.monthlyAmount);
  const precioAnual = cleanPrice(body.annualAmount);
  const estado = typeof body.status === "string" && body.status.trim() ? body.status.trim() : "activo";

  if (!nombre || precioMensual === null) {
    return NextResponse.json({ message: "Nombre y precio mensual son obligatorios." }, { status: 400 });
  }

  const basicPayload = {
    estado,
    limite_empresas: cleanLimit(body.companyLimit),
    limite_usuarios: cleanLimit(body.userLimit),
    nombre,
    precio_mensual: precioMensual,
  };

  const extendedPayload = {
    ...basicPayload,
    badge: cleanText(body.badge),
    beneficios: cleanTextArray(body.includes),
    descripcion: cleanText(body.description),
    limitaciones: cleanTextArray(body.limits),
    objetivo: cleanText(body.objective),
    orden: cleanLimit(body.order),
    precio_anual: precioAnual,
  };

  const savePlan = (payload: typeof basicPayload | typeof extendedPayload) => {
    return body.databaseId
      ? supabase.from("planes").update(payload).eq("id", body.databaseId)
      : supabase.from("planes").insert(payload);
  };

  const extendedResult = await savePlan(extendedPayload)
    .select(extendedPlanSelect)
    .single() as unknown as PlanMutationResult;
  let { data, error } = extendedResult;

  if (error && isMissingPlanColumnError(error)) {
    const fallback = await savePlan(basicPayload)
      .select(basicPlanSelect)
      .single() as unknown as PlanMutationResult;
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("Error al guardar plan:", error.message);
    return NextResponse.json({ message: "No fue posible guardar el plan." }, { status: 500 });
  }

  return NextResponse.json({ plan: data });
}
