import assert from "node:assert/strict";
import {
  FulfillmentStatus,
  LocalState,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import Stripe from "stripe";
import { processStripeWebhook } from "../../lib/checkout";

const prisma = new PrismaClient();
const stripe = new Stripe("test_stripe_secret_key", { apiVersion: Stripe.API_VERSION });
const webhookSecret = "test_webhook_secret";

process.env.STRIPE_SECRET_KEY = "test_stripe_secret_key";
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
process.env.STRIPE_TEST_MODE_ONLY = "true";
process.env.PRINTIFY_ENABLED = "false";

const idSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const localNumber = `TEST-${idSuffix}`;
const skuCode = `AO-TEST-${idSuffix}`;
const reservationId = `res_test_${idSuffix}`;
const orderId = `ord_test_${idSuffix}`;
const paymentId = `pay_test_${idSuffix}`;
const sessionId = `cs_test_${idSuffix}`;
const eventId = `evt_test_${idSuffix}`;

async function cleanup() {
  await prisma.webhookEvent.deleteMany({ where: { id: eventId } });
  await prisma.payment.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.deleteMany({ where: { id: orderId } });
  await prisma.inventoryReservation.deleteMany({ where: { id: reservationId } });
  await prisma.localSku.deleteMany({ where: { sku: skuCode } });
  await prisma.local.deleteMany({ where: { localNumber } });
}

async function setup() {
  const local = await prisma.local.create({
    data: {
      localNumber,
      conceptSentence: "Checkout webhook test.",
      state: LocalState.CONCEPT_DRAFT,
      approvedBlank: "Test blank",
      garmentColorways: ["Black"],
      editionCount: 1,
      retailPriceCents: 5000,
      currency: "USD",
    },
  });

  const sku = await prisma.localSku.create({
    data: {
      localId: local.id,
      sku: skuCode,
      size: "TEST",
      color: "Black",
      editionCeiling: 1,
    },
  });

  await prisma.inventoryReservation.create({
    data: {
      id: reservationId,
      localSkuId: sku.id,
      quantity: 1,
      status: ReservationStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 31 * 60 * 1000),
      stripeSessionId: sessionId,
    },
  });

  await prisma.order.create({
    data: {
      id: orderId,
      reservationId,
      status: OrderStatus.DRAFT,
      totalCents: 5000,
      currency: "USD",
      items: {
        create: {
          localId: local.id,
          localSkuId: sku.id,
          quantity: 1,
          unitCents: 5000,
        },
      },
    },
  });

  await prisma.payment.create({
    data: {
      id: paymentId,
      orderId,
      status: PaymentStatus.PENDING,
      stripeCheckoutSession: sessionId,
      amountCents: 5000,
      currency: "USD",
    },
  });
}

function signedCheckoutCompletedEvent() {
  const payload = JSON.stringify({
    id: eventId,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        metadata: {
          orderId,
          reservationId,
          localNumber,
          sku: skuCode,
          size: "TEST",
        },
        payment_intent: `pi_test_${idSuffix}`,
        payment_status: "paid",
        customer_details: {
          email: "checkout-test@example.com",
        },
      },
    },
  });

  return {
    payload,
    signature: stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    }),
  };
}

async function main() {
  await cleanup();
  await setup();

  try {
    const event = signedCheckoutCompletedEvent();
    const first = await processStripeWebhook(event.payload, event.signature);
    const second = await processStripeWebhook(event.payload, event.signature);

    assert.equal(first.action, "allocated");
    assert.equal(second.duplicate, true);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const reservation = await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } });
    const sku = await prisma.localSku.findUniqueOrThrow({ where: { sku: skuCode } });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const fulfillment = await prisma.fulfillmentOrder.findUniqueOrThrow({ where: { orderId } });

    assert.equal(order.status, OrderStatus.PAID);
    assert.equal(order.customerEmail, "checkout-test@example.com");
    assert.equal(reservation.status, ReservationStatus.ALLOCATED);
    assert.equal(sku.allocatedCount, 1);
    assert.equal(payment.status, PaymentStatus.PAID);
    assert.equal(fulfillment.status, FulfillmentStatus.NOT_SUBMITTED);
    assert.equal(fulfillment.printifyOrderId, null);
    assert.equal(first.fulfillmentAction, "disabled");

    console.log("checkout webhook tests passed");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  await prisma.$disconnect();
  process.exit(1);
});
