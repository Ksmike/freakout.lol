import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function hasConfiguredValue(value: string | undefined): value is string {
  return Boolean(value && !value.startsWith("replace-with-"));
}

export function isStripeConfigured(): boolean {
  return (
    hasConfiguredValue(process.env.STRIPE_SECRET_KEY) &&
    (hasConfiguredValue(process.env.STRIPE_SEAT_PRICE_ID) ||
      hasConfiguredValue(process.env.NEXT_PUBLIC_STRIPE_SEAT_PRICE_ID))
  );
}

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!hasConfiguredValue(secretKey)) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  stripeClient ??= new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!hasConfiguredValue(secret)) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  return secret;
}
