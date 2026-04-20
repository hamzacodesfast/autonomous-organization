import assert from "node:assert/strict";
import {
  FulfillmentStatus,
  LocalState,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import type Stripe from "stripe";
import { submitPrintifyDraftForCheckoutSession } from "../../lib/printify";

const prisma = new PrismaClient();

const originalFetch = globalThis.fetch;
const idSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const localNumber = `PRINTIFY-${idSuffix}`;
const skuCode = `AO-PRINTIFY-${idSuffix}-S`;
const reservationId = `res_printify_${idSuffix}`;
const orderId = `ord_printify_${idSuffix}`;
const paymentId = `pay_printify_${idSuffix}`;
const sessionId = `cs_printify_${idSuffix}`;

async function cleanup() {
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
      conceptSentence: "Printify fulfillment test.",
      state: LocalState.HUMAN_APPROVAL,
      approvedBlank: "Gildan 5000",
      supplier: "Printify",
      printProvider: "Printify Choice",
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
      size: "S",
      color: "Black",
      editionCeiling: 1,
      allocatedCount: 1,
    },
  });

  await prisma.inventoryReservation.create({
    data: {
      id: reservationId,
      localSkuId: sku.id,
      quantity: 1,
      status: ReservationStatus.ALLOCATED,
      expiresAt: new Date(Date.now() + 31 * 60 * 1000),
      allocatedAt: new Date(),
      stripeSessionId: sessionId,
    },
  });

  await prisma.order.create({
    data: {
      id: orderId,
      reservationId,
      status: OrderStatus.PAID,
      customerEmail: "buyer@example.com",
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
      status: PaymentStatus.PAID,
      stripeCheckoutSession: sessionId,
      stripePaymentIntent: `pi_printify_${idSuffix}`,
      amountCents: 5000,
      currency: "USD",
    },
  });

  await prisma.fulfillmentOrder.create({
    data: {
      id: `ful_printify_${idSuffix}`,
      orderId,
      status: FulfillmentStatus.NOT_SUBMITTED,
    },
  });
}

function checkoutSession() {
  return {
    id: sessionId,
    object: "checkout.session",
    client_reference_id: orderId,
    metadata: { orderId },
    customer_details: {
      email: "buyer@example.com",
      phone: "555-0100",
    },
    collected_information: {
      shipping_details: {
        name: "Ada Lovelace",
        address: {
          line1: "123 Logic Lane",
          line2: "Unit 1",
          city: "Toronto",
          state: "ON",
          postal_code: "M5V 2T6",
          country: "CA",
        },
      },
    },
  } as unknown as Stripe.Checkout.Session;
}

async function main() {
  await cleanup();
  await setup();

  process.env.PRINTIFY_ENABLED = "true";
  process.env.PRINTIFY_API_BASE_URL = "https://printify.test/v1";
  process.env.PRINTIFY_API_TOKEN = "test_printify_token";
  process.env.PRINTIFY_SHOP_ID = "12345";
  process.env.PRINTIFY_PRODUCT_ID = "printify_product_001";
  process.env.PRINTIFY_VARIANT_ID_S = "12126";
  process.env.PRINTIFY_SHIPPING_METHOD = "1";
  process.env.PRINTIFY_SEND_SHIPPING_NOTIFICATION = "false";

  let requestCount = 0;
  let requestBody: unknown;

  globalThis.fetch = async (input, init) => {
    requestCount += 1;
    assert.equal(String(input), "https://printify.test/v1/shops/12345/orders.json");
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test_printify_token");
    requestBody = JSON.parse(String(init?.body));

    return new Response(JSON.stringify({ id: "printify_order_001" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const first = await submitPrintifyDraftForCheckoutSession(checkoutSession());
    const second = await submitPrintifyDraftForCheckoutSession(checkoutSession());
    const fulfillment = await prisma.fulfillmentOrder.findUniqueOrThrow({ where: { orderId } });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });

    assert.equal(first.action, "submitted");
    assert.equal(first.printifyOrderId, "printify_order_001");
    assert.equal(second.action, "already_submitted");
    assert.equal(requestCount, 1);
    assert.equal(fulfillment.status, FulfillmentStatus.SUBMITTED);
    assert.equal(fulfillment.printifyOrderId, "printify_order_001");
    assert.deepEqual(requestBody, {
      external_id: orderId,
      label: `AO ${orderId}`,
      line_items: [
        {
          product_id: "printify_product_001",
          variant_id: 12126,
          quantity: 1,
          external_id: `${orderId}:${item.id}`,
        },
      ],
      shipping_method: 1,
      is_printify_express: false,
      is_economy_shipping: false,
      send_shipping_notification: false,
      address_to: {
        first_name: "Ada",
        last_name: "Lovelace",
        email: "buyer@example.com",
        phone: "555-0100",
        country: "CA",
        region: "ON",
        address1: "123 Logic Lane",
        address2: "Unit 1",
        city: "Toronto",
        zip: "M5V 2T6",
      },
    });

    console.log("printify fulfillment tests passed");
  } finally {
    globalThis.fetch = originalFetch;
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  globalThis.fetch = originalFetch;
  console.error(error);
  await cleanup();
  await prisma.$disconnect();
  process.exit(1);
});
