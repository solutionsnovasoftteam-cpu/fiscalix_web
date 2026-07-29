import "server-only";

import { randomUUID } from "node:crypto";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { FiscalixUser } from "@/models/User";

type NotificationType = "danger" | "info" | "success" | "warning";

type NotificationInput = {
  message: string;
  title: string;
  type?: NotificationType;
  url?: string | null;
  userId: string;
};

type CompanyScope = {
  id: string;
  name: string;
};

type SubscriptionNotificationRow = {
  empresa_id: string | null;
  estado_pago: string | null;
  fecha_proxima_facturacion: string | null;
  id: string;
};

type ObligationNotificationRow = {
  empresa_id: string | null;
  id: string;
  nombre: string | null;
};

const money = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function cleanText(value: string, fallback: string, maxLength: number) {
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    end: end.toISOString(),
    start: start.toISOString(),
  };
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "fecha por confirmar";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function createNotification({ message, title, type = "info", url = null, userId }: NotificationInput) {
  if (!userId) return false;

  const { error } = await supabase.from("notificaciones").insert({
    id: randomUUID(),
    leida: false,
    mensaje: cleanText(message, "Tienes una nueva notificación.", 800),
    tipo: type,
    titulo: cleanText(title, "Notificación", 120),
    url,
    usuario_id: userId,
  });

  if (error) {
    console.error("Error al crear notificación:", error.message);
    return false;
  }

  return true;
}

export async function createNotificationOncePerDay(input: NotificationInput) {
  if (!input.userId) return false;

  const title = cleanText(input.title, "Notificación", 120);
  const message = cleanText(input.message, "Tienes una nueva notificación.", 800);
  const { start, end } = todayRange();

  let query = supabase
    .from("notificaciones")
    .select("id")
    .eq("usuario_id", input.userId)
    .eq("titulo", title)
    .eq("mensaje", message)
    .gte("created_at", start)
    .lt("created_at", end)
    .limit(1);

  query = input.url ? query.eq("url", input.url) : query.is("url", null);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Error al deduplicar notificación:", error.message);
    return false;
  }
  if (data) return false;

  return createNotification({ ...input, message, title });
}

export async function createFinancialRecordNotification({
  actorUserId,
  amount,
  companyId,
  companyName,
  concept,
  kind,
}: {
  actorUserId: string;
  amount: number;
  companyId: string | null;
  companyName?: string | null;
  concept: string;
  kind: "expense" | "income";
}) {
  const userIds = new Set<string>([actorUserId]);

  if (companyId) {
    const { data, error } = await supabase
      .from("empresa_usuario")
      .select("usuario_id")
      .eq("empresa_id", companyId);

    if (error) {
      console.error("Error al buscar usuarios de empresa para notificación:", error.message);
    } else {
      for (const row of (data ?? []) as Array<{ usuario_id: string | null }>) {
        if (row.usuario_id) userIds.add(row.usuario_id);
      }
    }
  }

  const isExpense = kind === "expense";
  const title = isExpense ? "Gasto registrado" : "Ingreso registrado";
  const section = isExpense ? "gasto" : "ingreso";
  const companyText = companyName?.trim() ? ` en ${companyName.trim()}` : "";
  const message = `Se registró un ${section}${companyText} por ${money.format(amount)}: ${concept}.`;

  await Promise.all(
    [...userIds].map((userId) =>
      createNotification({
        message,
        title,
        type: "success",
        url: isExpense ? "/expenses" : "/income",
        userId,
      }),
    ),
  );
}

export async function createPlanSavedNotification({
  action,
  planName,
  userId,
}: {
  action: "created" | "updated";
  planName: string;
  userId: string;
}) {
  await createNotification({
    message: `El plan ${planName} fue ${action === "created" ? "creado" : "actualizado"} en Supabase.`,
    title: action === "created" ? "Plan creado" : "Plan actualizado",
    type: "success",
    url: "/plans",
    userId,
  });
}

export async function createAccountStatusNotifications({
  actor,
  nextStatus,
  targetName,
  targetUserId,
}: {
  actor: FiscalixUser;
  nextStatus: "activo" | "suspendido";
  targetName: string;
  targetUserId: string;
}) {
  const suspended = nextStatus === "suspendido";

  await Promise.all([
    createNotification({
      message: suspended
        ? "Tu cuenta fue suspendida por razones de seguridad. Contacta a un administrador para las aclaraciones correspondientes."
        : "Tu cuenta fue reactivada. Ya puedes ingresar nuevamente a Fiscalix.",
      title: suspended ? "Cuenta suspendida" : "Cuenta reactivada",
      type: suspended ? "warning" : "success",
      url: suspended ? null : "/dashboard",
      userId: targetUserId,
    }),
    createNotification({
      message: suspended
        ? `Suspendiste la cuenta de ${targetName}.`
        : `Reactivaste la cuenta de ${targetName}.`,
      title: suspended ? "Usuario suspendido" : "Usuario reactivado",
      type: "info",
      url: "/admin",
      userId: actor.id,
    }),
  ]);
}

async function getNotificationCompanyScope(user: FiscalixUser) {
  if (canViewAdminDashboard(user)) {
    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre_comercial")
      .neq("estado", "suspendida")
      .order("nombre_comercial", { ascending: true })
      .limit(80);

    if (error) throw new Error(error.message);

    return ((data ?? []) as Array<{ id: string; nombre_comercial: string | null }>).map<CompanyScope>((company) => ({
      id: company.id,
      name: company.nombre_comercial || "Sin empresa",
    }));
  }

  const { data, error } = await supabase
    .from("empresa_usuario")
    .select("empresa_id,empresas(id,nombre_comercial,estado)")
    .eq("usuario_id", user.id);

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    empresas: Array<{ estado: string | null; id: string; nombre_comercial: string | null }> | { estado: string | null; id: string; nombre_comercial: string | null } | null;
  }>)
    .map((membership) => firstRelation(membership.empresas))
    .filter((company): company is { estado: string | null; id: string; nombre_comercial: string | null } => company !== null && company.estado !== "suspendida")
    .map((company) => ({
      id: company.id,
      name: company.nombre_comercial || "Sin empresa",
    }));
}

export async function syncAutomaticNotificationsForUser(user: FiscalixUser) {
  try {
    const companies = await getNotificationCompanyScope(user);
    const companyIds = companies.map((company) => company.id);
    if (!companyIds.length) return;

    const companyNameById = new Map(companies.map((company) => [company.id, company.name]));
    const today = new Date();
    const todayKey = dateKey(today);
    const reminderLimitKey = dateKey(addDays(today, 7));
    const notificationUrl = canViewAdminDashboard(user) ? "/admin" : "/plans";

    const [{ data: subscriptions, error: subscriptionsError }, { count: obligationCount, data: obligations, error: obligationsError }] = await Promise.all([
      supabase
        .from("suscripciones")
        .select("id,empresa_id,estado_pago,fecha_proxima_facturacion")
        .in("empresa_id", companyIds)
        .limit(80),
      supabase
        .from("obligaciones_fiscales")
        .select("id,empresa_id,nombre", { count: "exact" })
        .in("empresa_id", companyIds)
        .eq("activa", true)
        .limit(3),
    ]);

    if (subscriptionsError) console.error("Error al sincronizar alertas de pagos:", subscriptionsError.message);
    if (obligationsError) console.error("Error al sincronizar alertas fiscales:", obligationsError.message);

    const subscriptionRows = ((subscriptions ?? []) as SubscriptionNotificationRow[])
      .filter((subscription) => subscription.empresa_id)
      .sort((a, b) => String(a.fecha_proxima_facturacion ?? "").localeCompare(String(b.fecha_proxima_facturacion ?? "")))
      .slice(0, 12);

    for (const subscription of subscriptionRows) {
      const companyName = companyNameById.get(subscription.empresa_id ?? "") ?? "Sin empresa";
      const billingDate = subscription.fecha_proxima_facturacion;

      if (subscription.estado_pago === "pago_no_acreditado") {
        await createNotificationOncePerDay({
          message: `No se acreditó el pago de ${companyName}. Revisa la suscripción para evitar interrupciones del servicio.`,
          title: "Pago no acreditado",
          type: "danger",
          url: notificationUrl,
          userId: user.id,
        });
      }

      if (subscription.estado_pago === "proxima_a_pagar" && billingDate && billingDate >= todayKey && billingDate <= reminderLimitKey) {
        await createNotificationOncePerDay({
          message: `La próxima facturación de ${companyName} está programada para ${formatDate(billingDate)}.`,
          title: "Pago próximo",
          type: "warning",
          url: notificationUrl,
          userId: user.id,
        });
      }

      if (subscription.estado_pago === "revision_manual") {
        await createNotificationOncePerDay({
          message: `La suscripción de ${companyName} requiere revisión manual de facturación.`,
          title: "Suscripción en revisión",
          type: "warning",
          url: notificationUrl,
          userId: user.id,
        });
      }
    }

    if (!obligationsError && (obligationCount ?? 0) > 0) {
      const sampleObligation = ((obligations ?? []) as ObligationNotificationRow[])[0];
      const title = "Obligaciones fiscales activas";
      const message = obligationCount === 1
        ? `Tienes 1 obligación fiscal activa por revisar: ${sampleObligation?.nombre ?? "obligación fiscal"}.`
        : `Tienes ${obligationCount} obligaciones fiscales activas por revisar.`;

      await createNotificationOncePerDay({
        message,
        title,
        type: "info",
        url: "/taxes",
        userId: user.id,
      });
    }
  } catch (error) {
    console.error("Error al sincronizar notificaciones automáticas:", error instanceof Error ? error.message : error);
  }
}
