import "server-only";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase";

type RegisteredUser = {
  apellido?: string | null;
  correo?: string | null;
  id: string;
  nombre?: string | null;
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

export type DefaultFreeSubscriptionResult = {
  assigned: boolean;
  companyId?: string;
  planId?: string;
  reason?: string;
  subscriptionId?: string;
};

function asNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || typeof value === "undefined") return 0;
  const parsed = Number(String(value).replace(/[$,\sA-Z]+/gi, ""));
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

function normalizePlanName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function defaultCompanyNameForUser(user: RegisteredUser) {
  const fullName = `${user.nombre ?? ""} ${user.apellido ?? ""}`.replace(/\s+/g, " ").trim();
  return fullName ? `${fullName} Servicios` : "Nueva empresa Fiscalix";
}

function defaultRfcForUser(userId: string) {
  const suffix = userId
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "0")
    .slice(0, 9)
    .padEnd(9, "0");

  return `FIS${suffix}`;
}

function isMissingBillingColumnError(error: { code?: string; details?: string; message?: string } | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst204") || text.includes("schema cache") || text.includes("estado_pago") || text.includes("monto_mensual");
}

async function findFreePlan() {
  const { data, error } = await supabase
    .from("planes")
    .select("id,nombre,precio_mensual,estado")
    .eq("estado", "activo")
    .order("precio_mensual", { ascending: true });

  if (error) throw new Error(`No se pudo consultar el plan Free: ${error.message}`);

  const plans = (data ?? []) as PlanRow[];
  return (
    plans.find((plan) => {
      const name = normalizePlanName(plan.nombre);
      return name.includes("free") || name.includes("gratis") || name.includes("gratuito");
    }) ??
    plans.find((plan) => asNumber(plan.precio_mensual) === 0) ??
    null
  );
}

async function getOrCreateCompanyForUser(user: RegisteredUser) {
  const { data: membership, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw new Error(`No se pudo consultar la empresa del usuario: ${membershipError.message}`);
  if (membership?.empresa_id) return String(membership.empresa_id);

  const rfc = defaultRfcForUser(user.id);
  const { data: existingCompany, error: existingCompanyError } = await supabase
    .from("empresas")
    .select("id")
    .eq("rfc", rfc)
    .maybeSingle();

  if (existingCompanyError) throw new Error(`No se pudo consultar la empresa inicial: ${existingCompanyError.message}`);

  let companyId = existingCompany?.id ? String(existingCompany.id) : "";

  if (!companyId) {
    const { data: company, error: companyError } = await supabase
      .from("empresas")
      .insert({
        estado: "activo",
        nombre_comercial: defaultCompanyNameForUser(user),
        rfc,
      })
      .select("id")
      .single();

    if (companyError || !company?.id) {
      throw new Error(`No se pudo crear la empresa inicial: ${companyError?.message ?? "sin id de empresa"}`);
    }

    companyId = String(company.id);
  }

  const { error: linkError } = await supabase.from("empresa_usuario").insert({
    id: randomUUID(),
    empresa_id: companyId,
    usuario_id: user.id,
  });

  if (linkError) throw new Error(`No se pudo vincular la empresa inicial: ${linkError.message}`);

  return companyId;
}

async function saveFreeSubscription(companyId: string, plan: PlanRow, user: RegisteredUser) {
  const { data: existingSubscription, error: existingError } = await supabase
    .from("suscripciones")
    .select("id,plan_id")
    .eq("empresa_id", companyId)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(`No se pudo consultar la suscripción inicial: ${existingError.message}`);

  const today = new Date();
  const basePayload = {
    empresa_id: companyId,
    plan_id: plan.id,
  };
  const extendedPayload = {
    ...basePayload,
    estado: "activa",
    estado_pago: "proxima_a_pagar",
    fecha_inicio: dateKey(today),
    fecha_proxima_facturacion: dateKey(addMonths(today, 1)),
    fecha_ultimo_pago: null,
    monto_mensual: asNumber(plan.precio_mensual),
    notas_facturacion: `Plan Free asignado automáticamente al registrar la cuenta ${user.correo ?? user.id}.`,
  };

  const subscription = existingSubscription as SubscriptionRow | null;
  const saveSubscription = (payload: typeof basePayload | typeof extendedPayload) => {
    return subscription
      ? supabase.from("suscripciones").update(payload).eq("id", subscription.id)
      : supabase.from("suscripciones").insert({ id: randomUUID(), ...payload });
  };

  const extendedResult = await saveSubscription(extendedPayload)
    .select("id,plan_id")
    .single() as unknown as {
      data: SubscriptionRow | null;
      error: { code?: string; details?: string; message: string } | null;
    };

  let savedSubscription = extendedResult.data;
  let subscriptionError = extendedResult.error;

  if (subscriptionError && isMissingBillingColumnError(subscriptionError)) {
    const fallbackResult = await saveSubscription(basePayload)
      .select("id,plan_id")
      .single() as unknown as {
        data: SubscriptionRow | null;
        error: { code?: string; details?: string; message: string } | null;
      };

    savedSubscription = fallbackResult.data;
    subscriptionError = fallbackResult.error;
  }

  if (subscriptionError || !savedSubscription) {
    throw new Error(`No se pudo crear la suscripción Free: ${subscriptionError?.message ?? "sin respuesta"}`);
  }

  return savedSubscription;
}

export async function assignFreePlanToNewUser(user: RegisteredUser): Promise<DefaultFreeSubscriptionResult> {
  try {
    const freePlan = await findFreePlan();
    if (!freePlan) {
      return {
        assigned: false,
        reason: "No existe un Plan Free o un plan activo con precio 0 en Supabase.",
      };
    }

    const companyId = await getOrCreateCompanyForUser(user);
    const subscription = await saveFreeSubscription(companyId, freePlan, user);

    return {
      assigned: true,
      companyId,
      planId: subscription.plan_id ?? freePlan.id,
      subscriptionId: subscription.id,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "No fue posible asignar el Plan Free.";
    console.error("Error al asignar Plan Free automático:", reason);
    return { assigned: false, reason };
  }
}
