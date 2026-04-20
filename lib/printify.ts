import { randomUUID } from "node:crypto";
import { FulfillmentStatus, OrderStatus } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const defaultPrintifyApiBaseUrl = "https://api.printify.com/v1";

const printifyVariantEnvBySize = {
  S: "PRINTIFY_VARIANT_ID_S",
  M: "PRINTIFY_VARIANT_ID_M",
  L: "PRINTIFY_VARIANT_ID_L",
  XL: "PRINTIFY_VARIANT_ID_XL",
  XXL: "PRINTIFY_VARIANT_ID_XXL",
} as const;

type Local001Size = keyof typeof printifyVariantEnvBySize;

export type PrintifyFulfillmentAction =
  | "missing_order"
  | "not_paid"
  | "disabled"
  | "already_submitted"
  | "submitted"
  | "failed_missing_shipping"
  | "failed_missing_line_items"
  | "failed_variant_mapping"
  | "failed_configuration"
  | "failed_api";

export type PrintifyFulfillmentResult = {
  action: PrintifyFulfillmentAction;
  status?: FulfillmentStatus;
  printifyOrderId?: string;
};

type PrintifyConfig = {
  apiBaseUrl: string;
  apiToken: string;
  shopId: string;
  productId: string;
  shippingMethod: number;
  sendShippingNotification: boolean;
};

type PrintifyAddress = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2: string;
  city: string;
  zip: string;
};

type PrintifyOrderPayload = {
  external_id: string;
  label: string;
  line_items: Array<{
    product_id: string;
    variant_id: number;
    quantity: number;
    external_id: string;
  }>;
  shipping_method: number;
  is_printify_express: false;
  is_economy_shipping: false;
  send_shipping_notification: boolean;
  address_to: PrintifyAddress;
};

class PrintifyFulfillmentError extends Error {
  constructor(
    readonly action: PrintifyFulfillmentAction,
    message: string,
  ) {
    super(message);
    this.name = "PrintifyFulfillmentError";
  }
}

export function printifyFulfillmentEnabled() {
  return process.env.PRINTIFY_ENABLED === "true";
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value || value.startsWith("PLACEHOLDER_")) {
    throw new PrintifyFulfillmentError("failed_configuration", `${name} is required for Printify fulfillment.`);
  }

  return value;
}

function integerEnv(name: string, fallback?: string) {
  const raw = process.env[name]?.trim() || fallback;

  if (!raw || !/^\d+$/.test(raw)) {
    throw new PrintifyFulfillmentError("failed_configuration", `${name} must be a positive integer.`);
  }

  const value = Number.parseInt(raw, 10);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new PrintifyFulfillmentError("failed_configuration", `${name} must be a positive integer.`);
  }

  return value;
}

function printifyConfig(): PrintifyConfig {
  return {
    apiBaseUrl: (process.env.PRINTIFY_API_BASE_URL || defaultPrintifyApiBaseUrl).replace(/\/$/, ""),
    apiToken: requiredEnv("PRINTIFY_API_TOKEN"),
    shopId: requiredEnv("PRINTIFY_SHOP_ID"),
    productId: requiredEnv("PRINTIFY_PRODUCT_ID"),
    shippingMethod: integerEnv("PRINTIFY_SHIPPING_METHOD", "1"),
    sendShippingNotification: process.env.PRINTIFY_SEND_SHIPPING_NOTIFICATION === "true",
  };
}

function orderIdFromCheckoutSession(session: Stripe.Checkout.Session) {
  return session.metadata?.orderId || session.client_reference_id || null;
}

async function loadOrderForFulfillment(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      fulfillment: true,
      items: {
        include: {
          localSku: true,
        },
      },
    },
  });
}

type PaidOrderForFulfillment = NonNullable<Awaited<ReturnType<typeof loadOrderForFulfillment>>>;

export async function ensureLocalFulfillmentDraft(orderId: string) {
  return prisma.fulfillmentOrder.upsert({
    where: { orderId },
    update: {},
    create: {
      id: `ful_${randomUUID()}`,
      orderId,
      status: FulfillmentStatus.NOT_SUBMITTED,
    },
  });
}

function requiredString(value: string | null | undefined, action: PrintifyFulfillmentAction) {
  const cleaned = value?.trim();

  if (!cleaned) {
    throw new PrintifyFulfillmentError(action, "Required fulfillment value is missing.");
  }

  return cleaned;
}

function splitRecipientName(name: string) {
  const parts = name.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

  if (parts.length === 0) {
    throw new PrintifyFulfillmentError("failed_missing_shipping", "Shipping recipient name is missing.");
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: parts[0],
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function printifyAddressFromCheckoutSession(
  session: Stripe.Checkout.Session,
  fallbackEmail?: string | null,
): PrintifyAddress {
  const shipping = session.collected_information?.shipping_details;

  if (!shipping) {
    throw new PrintifyFulfillmentError("failed_missing_shipping", "Checkout Session has no collected shipping details.");
  }

  const recipient = splitRecipientName(requiredString(shipping.name, "failed_missing_shipping"));
  const address = shipping.address;
  const email = requiredString(session.customer_details?.email ?? fallbackEmail, "failed_missing_shipping");

  return {
    first_name: recipient.firstName,
    last_name: recipient.lastName,
    email,
    phone: session.customer_details?.phone?.trim() || "",
    country: requiredString(address.country, "failed_missing_shipping").toUpperCase(),
    region: address.state?.trim() || "",
    address1: requiredString(address.line1, "failed_missing_shipping"),
    address2: address.line2?.trim() || "",
    city: requiredString(address.city, "failed_missing_shipping"),
    zip: requiredString(address.postal_code, "failed_missing_shipping"),
  };
}

function variantIdForSize(size: string) {
  const envName = printifyVariantEnvBySize[size as Local001Size];

  if (!envName) {
    throw new PrintifyFulfillmentError("failed_variant_mapping", `No Printify variant mapping exists for size ${size}.`);
  }

  return integerEnv(envName);
}

function printifyOrderPayload(
  order: PaidOrderForFulfillment,
  session: Stripe.Checkout.Session,
  config: PrintifyConfig,
): PrintifyOrderPayload {
  if (order.items.length === 0) {
    throw new PrintifyFulfillmentError("failed_missing_line_items", "Paid order has no line items.");
  }

  return {
    external_id: order.id,
    label: `AO ${order.id}`,
    line_items: order.items.map((item) => ({
      product_id: config.productId,
      variant_id: variantIdForSize(item.localSku.size),
      quantity: item.quantity,
      external_id: `${order.id}:${item.id}`,
    })),
    shipping_method: config.shippingMethod,
    is_printify_express: false,
    is_economy_shipping: false,
    send_shipping_notification: config.sendShippingNotification,
    address_to: printifyAddressFromCheckoutSession(session, order.customerEmail),
  };
}

async function createPrintifyOrder(config: PrintifyConfig, payload: PrintifyOrderPayload) {
  const response = await fetch(`${config.apiBaseUrl}/shops/${encodeURIComponent(config.shopId)}/orders.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": "AutonomousOrganization/0.1",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new PrintifyFulfillmentError(
      "failed_api",
      `Printify order create failed with HTTP ${response.status}.`,
    );
  }

  const data = (await response.json().catch(() => null)) as { id?: unknown } | null;

  if (!data || typeof data.id !== "string") {
    throw new PrintifyFulfillmentError("failed_api", "Printify order create response did not include an order id.");
  }

  return { id: data.id };
}

async function markFulfillmentFailed(orderId: string) {
  const fulfillment = await prisma.fulfillmentOrder.update({
    where: { orderId },
    data: { status: FulfillmentStatus.FAILED },
  });

  return fulfillment.status;
}

export async function submitPrintifyDraftForCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<PrintifyFulfillmentResult> {
  const orderId = orderIdFromCheckoutSession(session);

  if (!orderId) {
    return { action: "missing_order" };
  }

  const order = await loadOrderForFulfillment(orderId);

  if (!order) {
    return { action: "missing_order" };
  }

  if (order.status !== OrderStatus.PAID) {
    return { action: "not_paid" };
  }

  const fulfillment = order.fulfillment ?? (await ensureLocalFulfillmentDraft(order.id));

  if (fulfillment.printifyOrderId) {
    return {
      action: "already_submitted",
      status: fulfillment.status,
      printifyOrderId: fulfillment.printifyOrderId,
    };
  }

  if (!printifyFulfillmentEnabled()) {
    return {
      action: "disabled",
      status: fulfillment.status,
    };
  }

  try {
    const config = printifyConfig();
    const payload = printifyOrderPayload(order, session, config);
    const submitted = await createPrintifyOrder(config, payload);
    const updated = await prisma.fulfillmentOrder.update({
      where: { orderId: order.id },
      data: {
        status: FulfillmentStatus.SUBMITTED,
        printifyOrderId: submitted.id,
        submittedAt: new Date(),
      },
    });

    return {
      action: "submitted",
      status: updated.status,
      printifyOrderId: submitted.id,
    };
  } catch (error) {
    const action = error instanceof PrintifyFulfillmentError ? error.action : "failed_api";
    const status = await markFulfillmentFailed(order.id);

    console.error("Printify draft submission did not complete", {
      orderId: order.id,
      action,
      message: error instanceof Error ? error.message : "Unknown Printify fulfillment error.",
    });

    return {
      action,
      status,
    };
  }
}
