import "server-only";

import Stripe from "stripe";

function stripeSecretKey() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value || !value.startsWith("sk_test_")) {
    throw new Error("Stripe no está configurado con una clave secreta de prueba válida.");
  }
  return value;
}

export function getStripe() {
  return new Stripe(stripeSecretKey());
}
