"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

type ConfirmationResult = { message: string; planId: string | null };

export function StripeCheckoutModal({ clientSecret, onCancel, onConfirmed, sessionId }: { clientSecret: string; onCancel: () => void; onConfirmed: (result: ConfirmationResult) => void; sessionId: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    let active = true;
    let checkout: StripeEmbeddedCheckout | null = null;
    async function confirmPayment() {
      try {
        const response = await fetch("/api/stripe/confirm", { body: JSON.stringify({ sessionId }), headers: { "Content-Type": "application/json" }, method: "POST", signal: AbortSignal.timeout(20_000) });
        const result = await response.json() as { message?: string; subscription?: { plan_id?: string | null } };
        if (!response.ok) throw new Error(result.message ?? "No fue posible confirmar el pago.");
        if (active) onConfirmed({ message: result.message ?? "Pago acreditado exitosamente.", planId: result.subscription?.plan_id ?? null });
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "No fue posible confirmar el pago."); }
    }
    async function mountCheckout() {
      if (!publishableKey?.startsWith("pk_test_")) { setError("El servicio de pagos no está configurado correctamente."); return; }
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe || !mountRef.current || !active) throw new Error("No fue posible cargar el formulario de pago.");
        checkout = await stripe.createEmbeddedCheckoutPage({ clientSecret, onComplete: () => { void confirmPayment(); } });
        if (active && mountRef.current) checkout.mount(mountRef.current);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "No fue posible abrir el formulario de pago."); }
    }
    void mountCheckout();
    return () => { active = false; checkout?.destroy(); };
  }, [clientSecret, onConfirmed, sessionId]);

  return <section className="plans-editor stripe-checkout-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><div aria-labelledby="stripe-checkout-title" aria-modal="true" className="plans-editor-card stripe-checkout-modal" role="dialog" tabIndex={-1}><div className="plans-editor-heading stripe-checkout-heading"><div><p>Pago seguro</p><h2 id="stripe-checkout-title">Completa tu pago</h2><span>Los datos de tu tarjeta se procesan de forma segura.</span></div><button aria-label="Cerrar" type="button" onClick={onCancel}>×</button></div>{error ? <div className="plans-message" role="alert">{error}</div> : null}<div className="stripe-checkout-frame" ref={mountRef} /></div></section>;
}
