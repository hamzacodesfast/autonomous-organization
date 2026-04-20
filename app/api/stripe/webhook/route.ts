import { NextResponse } from "next/server";
import Stripe from "stripe";
import { CheckoutError, processStripeWebhook } from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  try {
    const result = await processStripeWebhook(rawBody, signature);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }

    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}
