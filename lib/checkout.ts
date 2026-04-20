import { createHash, randomUUID } from "node:crypto";
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  type PrismaClient,
  type Local,
  type LocalSku,
} from "@prisma/client";
import Stripe from "stripe";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStripe, getStripeWebhookSecret, stripeCheckoutEnabled } from "@/lib/stripe";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type LockedSku = LocalSku & {
  local: Local;
};

type CheckoutSessionCreateParams = NonNullable<Parameters<Stripe["checkout"]["sessions"]["create"]>[0]>;
type ShippingAllowedCountry = NonNullable<CheckoutSessionCreateParams["shipping_address_collection"]>["allowed_countries"][number];

const checkoutSizeSchema = z.enum(["S", "M", "L", "XL"]);
const local001SkuPrefix = "AO-001-BLACK";
const defaultReservationMinutes = 31;

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "checkout_error",
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type CheckoutSessionResult = {
  orderId: string;
  reservationId: string;
  sessionId: string;
  url: string;
};

function asStripeId(value: string | { id: string } | null | undefined) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function checkoutMetadata(input: {
  orderId: string;
  reservationId: string;
  localNumber: string;
  sku: string;
  size: string;
}) {
  return {
    orderId: input.orderId,
    reservationId: input.reservationId,
    localNumber: input.localNumber,
    sku: input.sku,
    size: input.size,
  };
}

function checkoutReservationMinutes() {
  const raw = process.env.STRIPE_CHECKOUT_RESERVATION_MINUTES;

  if (!raw) {
    return defaultReservationMinutes;
  }

  const minutes = Number.parseInt(raw, 10);

  if (!Number.isFinite(minutes) || minutes < 31 || minutes > 1440) {
    throw new CheckoutError("Checkout reservation window must be between 31 and 1440 minutes.", 500, "config_error");
  }

  return minutes;
}

function siteUrl(requestOrigin?: string) {
  const value = process.env.PUBLIC_SITE_URL || process.env.APP_URL || requestOrigin || "http://localhost:3000";
  return value.replace(/\/$/, "");
}

function automaticTaxEnabled() {
  return process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true";
}

function allowedShippingCountries(): ShippingAllowedCountry[] {
  const raw = process.env.STRIPE_ALLOWED_SHIPPING_COUNTRIES || "US,CA";
  const countries = raw
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);

  if (countries.length === 0) {
    throw new CheckoutError("At least one Stripe shipping country must be configured.", 500, "config_error");
  }

  return countries as ShippingAllowedCountry[];
}

function normalizeSize(size: string) {
  const parsed = checkoutSizeSchema.safeParse(size.trim().toUpperCase());

  if (!parsed.success) {
    throw new CheckoutError("Select an available Local No. 001 size.", 400, "invalid_size");
  }

  return parsed.data;
}

function hashPayload(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

async function lockSku(tx: TransactionClient, sku: string) {
  await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM "LocalSku" WHERE sku = ${sku} FOR UPDATE`;

  const record = await tx.localSku.findUnique({
    where: { sku },
    include: { local: true },
  });

  if (!record) {
    throw new CheckoutError("Selected size is not available.", 404, "sku_not_found");
  }

  return record;
}

async function activeReservedCount(tx: TransactionClient, localSkuId: number, now: Date) {
  const result = await tx.inventoryReservation.aggregate({
    _sum: { quantity: true },
    where: {
      localSkuId,
      status: ReservationStatus.ACTIVE,
      expiresAt: { gt: now },
    },
  });

  return result._sum.quantity ?? 0;
}

async function expireStaleReservations(tx: TransactionClient, now: Date) {
  await tx.inventoryReservation.updateMany({
    where: {
      status: ReservationStatus.ACTIVE,
      expiresAt: { lte: now },
    },
    data: {
      status: ReservationStatus.EXPIRED,
    },
  });
}

async function cancelDraftCheckout(input: { orderId: string; reservationId: string }) {
  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { orderId: input.orderId },
      data: { status: PaymentStatus.FAILED },
    }),
    prisma.order.updateMany({
      where: { id: input.orderId, status: OrderStatus.DRAFT },
      data: { status: OrderStatus.CANCELLED },
    }),
    prisma.inventoryReservation.updateMany({
      where: { id: input.reservationId, status: ReservationStatus.ACTIVE },
      data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
    }),
  ]);
}

async function createDraftCheckout(size: string) {
  const now = new Date();
  const reservationMinutes = checkoutReservationMinutes();
  const expiresAt = new Date(now.getTime() + reservationMinutes * 60 * 1000);
  const skuCode = `${local001SkuPrefix}-${size}`;

  return prisma.$transaction(
    async (tx) => {
      await expireStaleReservations(tx, now);

      const sku = await lockSku(tx, skuCode);
      const activeReserved = await activeReservedCount(tx, sku.id, now);
      const available = sku.editionCeiling - sku.allocatedCount - activeReserved;

      if (available < 1) {
        throw new CheckoutError("Selected size is sold out.", 409, "sold_out");
      }

      const reservationId = `res_${randomUUID()}`;
      const orderId = `ord_${randomUUID()}`;

      await tx.inventoryReservation.create({
        data: {
          id: reservationId,
          localSkuId: sku.id,
          quantity: 1,
          status: ReservationStatus.ACTIVE,
          expiresAt,
        },
      });

      await tx.order.create({
        data: {
          id: orderId,
          reservationId,
          status: OrderStatus.DRAFT,
          totalCents: sku.local.retailPriceCents,
          currency: sku.local.currency,
          items: {
            create: {
              localId: sku.localId,
              localSkuId: sku.id,
              quantity: 1,
              unitCents: sku.local.retailPriceCents,
            },
          },
        },
      });

      return {
        orderId,
        reservationId,
        sku,
        expiresAt,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function checkoutSessionParams(input: {
  orderId: string;
  reservationId: string;
  sku: LockedSku;
  requestOrigin?: string;
  expiresAt: Date;
}): CheckoutSessionCreateParams {
  const baseUrl = siteUrl(input.requestOrigin);
  const currency = input.sku.local.currency.toLowerCase();
  const metadata = checkoutMetadata({
    orderId: input.orderId,
    reservationId: input.reservationId,
    localNumber: input.sku.local.localNumber,
    sku: input.sku.sku,
    size: input.sku.size,
  });

  return {
    mode: "payment",
    client_reference_id: input.orderId,
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/locals/001?checkout=cancelled`,
    expires_at: Math.floor(input.expiresAt.getTime() / 1000),
    automatic_tax: { enabled: automaticTaxEnabled() },
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      shipping_address: {
        message: "Test-mode checkout. Production shipping countries and rates require final approval.",
      },
      submit: {
        message: "Payment confirms only after the server receives Stripe's signed webhook.",
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: input.sku.local.retailPriceCents,
          product_data: {
            name: "LOCAL NO. 001 TEE",
            description: `Black Gildan 5000 tee. Back print. Size ${input.sku.size}.`,
            metadata,
          },
        },
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
    },
    shipping_address_collection: {
      allowed_countries: allowedShippingCountries(),
    },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Test shipping",
          fixed_amount: {
            amount: 0,
            currency,
          },
        },
      },
    ],
    submit_type: "pay",
  };
}

export async function createCheckoutSessionForLocal001(input: {
  size: string;
  requestOrigin?: string;
}): Promise<CheckoutSessionResult> {
  if (!stripeCheckoutEnabled()) {
    throw new CheckoutError("Stripe test checkout is disabled.", 403, "checkout_disabled");
  }

  const size = normalizeSize(input.size);
  const stripe = getStripe();
  const draft = await createDraftCheckout(size);
  let session: Stripe.Checkout.Session | undefined;

  try {
    session = await stripe.checkout.sessions.create(checkoutSessionParams({ ...draft, requestOrigin: input.requestOrigin }), {
      idempotencyKey: `checkout-session:${draft.orderId}`,
    });

    if (!session.url) {
      throw new CheckoutError("Stripe did not return a checkout URL.", 502, "stripe_session_missing_url");
    }

    await prisma.$transaction([
      prisma.inventoryReservation.update({
        where: { id: draft.reservationId },
        data: { stripeSessionId: session.id },
      }),
      prisma.payment.create({
        data: {
          id: `pay_${randomUUID()}`,
          orderId: draft.orderId,
          status: PaymentStatus.PENDING,
          stripeCheckoutSession: session.id,
          stripePaymentIntent: asStripeId(session.payment_intent),
          amountCents: draft.sku.local.retailPriceCents,
          currency: draft.sku.local.currency,
        },
      }),
    ]);

    return {
      orderId: draft.orderId,
      reservationId: draft.reservationId,
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    if (session?.id && session.status === "open") {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    }

    await cancelDraftCheckout(draft);
    throw error;
  }
}

function isCheckoutSession(value: Stripe.Event.Data.Object): value is Stripe.Checkout.Session {
  return typeof value === "object" && value !== null && "object" in value && value.object === "checkout.session";
}

async function findOrderForSession(tx: TransactionClient, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;

  if (orderId) {
    return tx.order.findUnique({
      where: { id: orderId },
      include: {
        reservation: { include: { localSku: true } },
      },
    });
  }

  return tx.order.findFirst({
    where: {
      payments: {
        some: { stripeCheckoutSession: session.id },
      },
    },
    include: {
      reservation: { include: { localSku: true } },
    },
  });
}

async function markCheckoutSessionPaid(tx: TransactionClient, session: Stripe.Checkout.Session) {
  const order = await findOrderForSession(tx, session);

  if (!order) {
    return "missing_order";
  }

  const paymentIntentId = asStripeId(session.payment_intent);
  const customerEmail = session.customer_details?.email ?? null;

  await tx.payment.upsert({
    where: { stripeCheckoutSession: session.id },
    update: {
      status: PaymentStatus.PAID,
      stripePaymentIntent: paymentIntentId,
    },
    create: {
      id: `pay_${randomUUID()}`,
      orderId: order.id,
      status: PaymentStatus.PAID,
      stripeCheckoutSession: session.id,
      stripePaymentIntent: paymentIntentId,
      amountCents: order.totalCents,
      currency: order.currency,
    },
  });

  if (order.status === OrderStatus.PAID || order.reservation.status === ReservationStatus.ALLOCATED) {
    return "already_paid";
  }

  if (order.reservation.status !== ReservationStatus.ACTIVE) {
    return "reservation_not_active";
  }

  await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM "LocalSku" WHERE id = ${order.reservation.localSkuId} FOR UPDATE`;

  const latestSku = await tx.localSku.findUnique({
    where: { id: order.reservation.localSkuId },
  });

  if (!latestSku) {
    throw new Error("Paid checkout cannot allocate a missing SKU.");
  }

  if (latestSku.allocatedCount + order.reservation.quantity > latestSku.editionCeiling) {
    throw new Error("Paid checkout would exceed SKU edition ceiling.");
  }

  await tx.localSku.update({
    where: { id: latestSku.id },
    data: { allocatedCount: { increment: order.reservation.quantity } },
  });

  await tx.inventoryReservation.update({
    where: { id: order.reservationId },
    data: {
      status: ReservationStatus.ALLOCATED,
      allocatedAt: new Date(),
    },
  });

  await tx.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.PAID,
      customerEmail,
    },
  });

  return "allocated";
}

async function markCheckoutSessionFailed(
  tx: TransactionClient,
  session: Stripe.Checkout.Session,
  reservationStatus: typeof ReservationStatus.EXPIRED | typeof ReservationStatus.CANCELLED,
) {
  const order = await findOrderForSession(tx, session);

  if (!order || order.status === OrderStatus.PAID) {
    return order ? "already_paid" : "missing_order";
  }

  await tx.payment.updateMany({
    where: { orderId: order.id },
    data: { status: PaymentStatus.FAILED },
  });

  await tx.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.CANCELLED },
  });

  await tx.inventoryReservation.update({
    where: { id: order.reservationId },
    data: {
      status: reservationStatus,
      cancelledAt: reservationStatus === ReservationStatus.CANCELLED ? new Date() : order.reservation.cancelledAt,
    },
  });

  return "cancelled";
}

export async function processStripeWebhook(rawBody: string, signature: string | null) {
  if (!signature) {
    throw new CheckoutError("Missing Stripe signature header.", 400, "missing_signature");
  }

  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  const payloadHash = hashPayload(rawBody);

  return prisma.$transaction(
    async (tx) => {
      const existingEvent = await tx.webhookEvent.findUnique({
        where: { id: event.id },
      });

      if (existingEvent) {
        return { received: true, duplicate: true, eventType: event.type, action: "duplicate" };
      }

      await tx.webhookEvent.create({
        data: {
          id: event.id,
          platform: "stripe",
          eventType: event.type,
          payloadHash,
        },
      });

      if (!isCheckoutSession(event.data.object)) {
        return { received: true, duplicate: false, eventType: event.type, action: "ignored" };
      }

      if (event.type === "checkout.session.completed") {
        if (event.data.object.payment_status === "paid") {
          const action = await markCheckoutSessionPaid(tx, event.data.object);
          return { received: true, duplicate: false, eventType: event.type, action };
        }

        return { received: true, duplicate: false, eventType: event.type, action: "awaiting_payment" };
      }

      if (event.type === "checkout.session.async_payment_succeeded") {
        const action = await markCheckoutSessionPaid(tx, event.data.object);
        return { received: true, duplicate: false, eventType: event.type, action };
      }

      if (event.type === "checkout.session.async_payment_failed") {
        const action = await markCheckoutSessionFailed(tx, event.data.object, ReservationStatus.CANCELLED);
        return { received: true, duplicate: false, eventType: event.type, action };
      }

      if (event.type === "checkout.session.expired") {
        const action = await markCheckoutSessionFailed(tx, event.data.object, ReservationStatus.EXPIRED);
        return { received: true, duplicate: false, eventType: event.type, action };
      }

      return { received: true, duplicate: false, eventType: event.type, action: "ignored" };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
