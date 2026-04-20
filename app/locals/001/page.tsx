import { ProductMockup } from "@/app/components/product-mockup";
import { getCurrentLocal } from "@/lib/locals-repository";
import { stripeCheckoutEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Local001PageProps = {
  searchParams?: Promise<{
    checkout?: string | string[];
  }>;
};

function checkoutStatusText(status: string | string[] | undefined) {
  const value = Array.isArray(status) ? status[0] : status;

  if (value === "cancelled") {
    return "Checkout cancelled. Inventory returns only through server records.";
  }

  if (value === "sold_out") {
    return "Selected size is sold out.";
  }

  if (value === "checkout_disabled") {
    return "Checkout is disabled until the test-mode gate is open.";
  }

  if (value === "invalid_size") {
    return "Select an available size.";
  }

  if (value) {
    return "Checkout could not start. The Organization halted before payment.";
  }

  return null;
}

export default async function Local001Page({ searchParams }: Local001PageProps) {
  const local001 = await getCurrentLocal();
  const checkoutEnabled = stripeCheckoutEnabled();
  const params = await searchParams;
  const checkoutStatus = checkoutStatusText(params?.checkout);

  return (
    <>
      <section className="section product-grid">
        <div>
          <p className="eyebrow">Issued by Local No. {local001.number}</p>
          <h1>{local001.name}</h1>
        </div>
        <div className="product-copy">
          <span className="status">{local001.status}</span>
          <p>{local001.garment}</p>
          <p>{local001.graphic}</p>
          <p>{local001.specifications}</p>
          <ul className="metadata">
            <li>Price: {local001.price}</li>
            <li>Edition: {local001.editionCount} units. No restocks.</li>
            <li>Shipping: {local001.shipping}</li>
          </ul>
          {checkoutStatus ? <p className="status-note">{checkoutStatus}</p> : null}
          {checkoutEnabled ? (
            <form className="checkout-form" action="/api/checkout/sessions" method="post">
              <fieldset>
                <legend>Size</legend>
                <div className="size-grid">
                  {local001.allocation.map((row) => (
                    <label key={row.size}>
                      <input name="size" type="radio" value={row.size} required />
                      <span>{row.size}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="button" type="submit">
                Test Checkout
              </button>
              <p className="form-note">Stripe test mode only. Server records decide allocation.</p>
            </form>
          ) : (
            <span className="button" aria-disabled="true">
              Checkout Disabled
            </span>
          )}
        </div>
      </section>

      <section className="section mockup-grid" aria-label="Product mockups">
        <ProductMockup
          src={local001.backMockup}
          alt="Back mockup of Local No. 001 black tee with primary mark"
          mark
          priority
        />
        <ProductMockup
          src={local001.frontMockup}
          alt="Front mockup of Local No. 001 black tee"
          priority
        />
      </section>

      <section className="section">
        <h2>Allocation</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Units</th>
            </tr>
          </thead>
          <tbody>
            {local001.allocation.map((row) => (
              <tr key={row.size}>
                <td>{row.size}</td>
                <td>{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
