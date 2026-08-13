import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGmailSetupStatus, sendSupportEmail } from "@/lib/gmailSupport";
import { createNotification } from "@/lib/notifications";
import { getStripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

type RequestBody = { sessionId?: unknown };
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const addMonths = (date: Date, months: number) => { const result = new Date(date); result.setMonth(result.getMonth() + months); return result; };
const formatCurrency = (amountInCents: number | null) => new Intl.NumberFormat("es-MX", { currency: "MXN", style: "currency" }).format((amountInCents ?? 0) / 100);

async function sendPaymentReceiptEmail({
  amountInCents,
  billingPeriod,
  planName,
  reference,
  to,
}: {
  amountInCents: number | null;
  billingPeriod: "annual" | "monthly";
  planName: string;
  reference: string;
  to: string;
}) {
  if (!getGmailSetupStatus().configured) return;

  const period = billingPeriod === "annual" ? "Anual" : "Mensual";
  await sendSupportEmail({
    body: [
      "Hola,",
      "",
      "Tu pago ha sido acreditado exitosamente.",
      "",
      `Plan: ${planName}`,
      `Modalidad: ${period}`,
      `Importe: ${formatCurrency(amountInCents)}`,
      `Fecha: ${new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date())}`,
      `Referencia: ${reference}`,
      "",
      "Gracias por utilizar Fiscalix.",
    ].join("\n"),
    subject: "Fiscalix · Pago acreditado exitosamente",
    to,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  let body: RequestBody;
  try { body = await request.json() as RequestBody; } catch { return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 }); }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_test_")) return NextResponse.json({ message: "La sesión de pago no es válida." }, { status: 400 });

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const planId = session.metadata?.planId;
    const companyId = session.metadata?.companyId;
    const billingPeriod = session.metadata?.billingPeriod === "annual" ? "annual" : "monthly";
    if (session.client_reference_id !== user.id || !planId || !companyId || session.payment_status !== "paid") {
      return NextResponse.json({ message: "El pago no pudo ser validado para tu cuenta." }, { status: 400 });
    }
    const { data: membership } = await supabase.from("empresa_usuario").select("empresa_id").eq("usuario_id", user.id).eq("empresa_id", companyId).maybeSingle();
    if (!membership) return NextResponse.json({ message: "No tienes acceso a la empresa de esta compra." }, { status: 403 });
    const { data: plan } = await supabase.from("planes").select("nombre,precio_mensual").eq("id", planId).maybeSingle();
    if (!plan) return NextResponse.json({ message: "El plan de esta compra ya no existe." }, { status: 404 });
    const { data: existing } = await supabase.from("suscripciones").select("id").eq("empresa_id", companyId).maybeSingle();
    const today = new Date();
    const basicPayload = { empresa_id: companyId, plan_id: planId };
    const payload = { ...basicPayload, estado: "activa", estado_pago: "pagado_exito_mes", fecha_inicio: dateKey(today), fecha_ultimo_pago: dateKey(today), fecha_proxima_facturacion: dateKey(addMonths(today, billingPeriod === "annual" ? 12 : 1)), monto_mensual: Number(plan.precio_mensual), notas_facturacion: `Pago acreditado exitosamente (${billingPeriod === "annual" ? "periodo anual" : "periodo mensual"}, referencia ${session.id}).` };
    const save = (data: typeof basicPayload | typeof payload) => existing
      ? supabase.from("suscripciones").update(data).eq("id", existing.id)
      : supabase.from("suscripciones").insert({ id: randomUUID(), ...data });
    let { data: subscription, error } = await save(payload).select("id,plan_id").single();
    if (error && /pgrst204|schema cache|estado_pago|fecha_ultimo_pago|monto_mensual/i.test(`${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`)) {
      ({ data: subscription, error } = await save(basicPayload).select("id,plan_id").single());
    }
    if (error || !subscription) throw error ?? new Error("No se pudo guardar la suscripción.");
    await createNotification({ message: `Pago acreditado exitosamente para ${plan.nombre}.`, title: "Plan activado", type: "success", url: "/plans", userId: user.id });
    try {
      await sendPaymentReceiptEmail({
        amountInCents: session.amount_total,
        billingPeriod,
        planName: plan.nombre,
        reference: session.id,
        to: user.correo,
      });
    } catch (emailError) {
      console.error("No fue posible enviar el recibo por correo:", emailError instanceof Error ? emailError.message : emailError);
    }
    return NextResponse.json({ message: `Pago acreditado exitosamente. ${plan.nombre} está activo.`, subscription });
  } catch (error) {
    console.error("Error al confirmar Checkout de Stripe:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible confirmar el pago." }, { status: 500 });
  }
}
