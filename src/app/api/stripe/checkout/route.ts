import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { USER_ROLES } from "@/lib/roles";
import { getStripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

type RequestBody = { billingPeriod?: unknown; planId?: unknown };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  if (user.rol !== USER_ROLES.CLIENT) return NextResponse.json({ message: "Solo los usuarios cliente pueden contratar planes." }, { status: 403 });

  let body: RequestBody;
  try { body = await request.json() as RequestBody; } catch { return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 }); }
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const billingPeriod = body.billingPeriod === "annual" ? "annual" : "monthly";
  if (!planId) return NextResponse.json({ message: "Selecciona un plan válido." }, { status: 400 });

  const [{ data: plan, error: planError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from("planes").select("id,nombre,precio_mensual,precio_anual,estado").eq("id", planId).maybeSingle(),
    supabase.from("empresa_usuario").select("empresa_id").eq("usuario_id", user.id).limit(1).maybeSingle(),
  ]);
  if (planError || !plan) return NextResponse.json({ message: "El plan seleccionado no existe." }, { status: 404 });
  if (plan.estado && plan.estado !== "activo") return NextResponse.json({ message: "Este plan no está disponible." }, { status: 400 });
  if (membershipError || !membership?.empresa_id) return NextResponse.json({ message: "Necesitas registrar una empresa antes de contratar un plan." }, { status: 400 });

  const amount = Number(billingPeriod === "annual" ? plan.precio_anual : plan.precio_mensual);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ message: "Este plan no requiere pago. Selecciónalo directamente." }, { status: 400 });

  try {
    const session = await getStripe().checkout.sessions.create({
      client_reference_id: user.id,
      customer_email: user.correo,
      line_items: [{
        price_data: {
          currency: "mxn",
          product_data: { name: `${plan.nombre} · ${billingPeriod === "annual" ? "Anual" : "Mensual"}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      metadata: { billingPeriod, companyId: membership.empresa_id, planId: plan.id },
      mode: "payment",
      payment_intent_data: {
        description: `${plan.nombre} · ${billingPeriod === "annual" ? "Periodo anual" : "Periodo mensual"}`,
        receipt_email: user.correo,
      },
      payment_method_types: ["card"],
      redirect_on_completion: "never",
      ui_mode: "embedded_page",
    });
    if (!session.client_secret) throw new Error("El servicio de pagos no devolvió una sesión válida.");
    return NextResponse.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (error) {
    console.error("Error al crear Checkout de Stripe:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "No fue posible iniciar el pago." }, { status: 503 });
  }
}
