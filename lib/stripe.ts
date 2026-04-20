import Stripe from "stripe";

let stripe: Stripe | undefined;

export function stripeCheckoutEnabled() {
  return process.env.STRIPE_CHECKOUT_ENABLED === "true" && process.env.ENABLE_DATABASE_READS === "true";
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || secret.startsWith("PLACEHOLDER_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required for Stripe webhook verification.");
  }

  return secret;
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || secretKey.startsWith("PLACEHOLDER_")) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe Checkout.");
  }

  if (process.env.STRIPE_TEST_MODE_ONLY !== "false" && secretKey.startsWith("sk_live_")) {
    throw new Error("Live Stripe keys are blocked while STRIPE_TEST_MODE_ONLY is enabled.");
  }

  if (!stripe) {
    const apiVersion = process.env.STRIPE_API_VERSION || Stripe.API_VERSION;

    stripe = new Stripe(secretKey, {
      apiVersion: apiVersion as typeof Stripe.API_VERSION,
    });
  }

  return stripe;
}
