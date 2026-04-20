import { NextResponse } from "next/server";
import { CheckoutError, createCheckoutSessionForLocal001 } from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkoutSizeFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { size?: unknown };
    return typeof body.size === "string" ? body.size : "";
  }

  const formData = await request.formData();
  const size = formData.get("size");
  return typeof size === "string" ? size : "";
}

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  return url.origin;
}

function errorRedirect(request: Request, error: unknown) {
  const url = new URL("/locals/001", request.url);

  if (error instanceof CheckoutError) {
    url.searchParams.set("checkout", error.code);
  } else {
    url.searchParams.set("checkout", "checkout_error");
  }

  return NextResponse.redirect(url, { status: 303 });
}

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

export async function POST(request: Request) {
  try {
    const result = await createCheckoutSessionForLocal001({
      size: await checkoutSizeFromRequest(request),
      requestOrigin: requestOrigin(request),
    });

    if (wantsJson(request)) {
      return NextResponse.json(result);
    }

    return NextResponse.redirect(result.url, { status: 303 });
  } catch (error) {
    if (wantsJson(request)) {
      const status = error instanceof CheckoutError ? error.status : 500;
      const code = error instanceof CheckoutError ? error.code : "checkout_error";
      return NextResponse.json({ error: code }, { status });
    }

    return errorRedirect(request, error);
  }
}
