import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getApiUser, getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { USER_ROLES } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type SubscribePayload = {
  planId?: unknown;
};

type PlanRow = {
  estado: string | null;
  id: string;
  nombre: string;
  precio_mensual: number | string | null;
};

type SubscriptionRow = {
  id: string;
  plan_id: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || typeof value === "undefined") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function isMissingBillingColumnError(error: { code?: string; details?: string; message?: string } | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst204") || text.includes("schema cache") || text.includes("estado_pago") || text.includes("monto_mensual");
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("Error al consultar empresa del usuario:", membershipError.message);
    return NextResponse.json({ message: "No fue posible consultar tu empresa." }, { status: 500 });
  }

  const empresaId = membership?.empresa_id as string | null | undefined;
  if (!empresaId) {
    return NextResponse.json({ subscription: null });
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("suscripciones")
    .select("id,plan_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (subscriptionError) {
    console.error("Error al consultar suscripción actual:", subscriptionError.message);
    return NextResponse.json({ message: "No fue posible consultar tu suscripción actual." }, { status: 500 });
  }

  return NextResponse.json({ subscription: subscription ?? null });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  if (user.rol !== USER_ROLES.CLIENT) {
    return NextResponse.json({ message: "Solo los usuarios cliente pueden suscribirse a un plan." }, { status: 403 });
  }

  let body: SubscribePayload;
  try {
    body = (await request.json()) as SubscribePayload;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  const planId = cleanText(body.planId);
  if (!planId) {
    return NextResponse.json({ message: "Selecciona un plan válido." }, { status: 400 });
  }

  const { data: plan, error: planError } = await supabase
    .from("planes")
    .select("id,nombre,precio_mensual,estado")
    .eq("id", planId)
    .maybeSingle();

  if (planError) {
    console.error("Error al consultar plan para suscripción:", planError.message);
    return NextResponse.json({ message: "No fue posible consultar el plan." }, { status: 500 });
  }

  if (!plan) {
    return NextResponse.json({ message: "El plan seleccionado no existe en Supabase." }, { status: 404 });
  }

  const planRow = plan as PlanRow;
  if (planRow.estado && planRow.estado !== "activo") {
    return NextResponse.json({ message: "Este plan no está disponible para suscripción." }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("empresa_id,empresas(id,nombre_comercial,estado)")
    .eq("usuario_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("Error al consultar empresa del usuario:", membershipError.message);
    return NextResponse.json({ message: "No fue posible consultar tu empresa." }, { status: 500 });
  }

  const empresaId = membership?.empresa_id as string | null | undefined;
  if (!empresaId) {
    return NextResponse.json(
      { message: "Necesitas registrar una empresa antes de suscribirte a un plan." },
      { status: 400 },
    );
  }

  const { data: existingSubscription, error: existingError } = await supabase
    .from("suscripciones")
    .select("id,plan_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (existingError) {
    console.error("Error al consultar suscripción existente:", existingError.message);
    return NextResponse.json({ message: "No fue posible consultar tu suscripción actual." }, { status: 500 });
  }

  const today = new Date();
  const basePayload = {
    empresa_id: empresaId,
    plan_id: planRow.id,
  };
  const extendedPayload = {
    ...basePayload,
    estado: "activa",
    estado_pago: "proxima_a_pagar",
    fecha_inicio: dateKey(today),
    fecha_proxima_facturacion: dateKey(addMonths(today, 1)),
    monto_mensual: asNumber(planRow.precio_mensual),
    notas_facturacion: `Suscripción solicitada desde la página de planes por ${user.correo}.`,
  };

  const subscriptionRow = existingSubscription as SubscriptionRow | null;
  const saveSubscription = (payload: typeof basePayload | typeof extendedPayload) => {
    return subscriptionRow
      ? supabase.from("suscripciones").update(payload).eq("id", subscriptionRow.id)
      : supabase.from("suscripciones").insert({ id: randomUUID(), ...payload });
  };

  const extendedResult = await saveSubscription(extendedPayload)
    .select("id,plan_id")
    .single() as unknown as {
      data: SubscriptionRow | null;
      error: { code?: string; details?: string; message: string } | null;
    };

  let subscription = extendedResult.data;
  let subscriptionError = extendedResult.error;

  if (subscriptionError && isMissingBillingColumnError(subscriptionError)) {
    const fallbackResult = await saveSubscription(basePayload)
      .select("id,plan_id")
      .single() as unknown as {
        data: SubscriptionRow | null;
        error: { code?: string; details?: string; message: string } | null;
      };

    subscription = fallbackResult.data;
    subscriptionError = fallbackResult.error;
  }

  if (subscriptionError || !subscription) {
    console.error("Error al guardar suscripción:", subscriptionError?.message);
    return NextResponse.json({ message: "No fue posible guardar tu suscripción." }, { status: 500 });
  }

  await createNotification({
    message: `Tu empresa fue suscrita al ${planRow.nombre}.`,
    title: "Suscripción actualizada",
    type: "success",
    url: "/plans",
    userId: user.id,
  });

  return NextResponse.json({
    message: `Te suscribiste correctamente al ${planRow.nombre}.`,
    subscription,
  });
}
