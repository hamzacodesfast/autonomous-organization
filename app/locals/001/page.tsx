import { ProductMockup } from "@/app/components/product-mockup";
import { getCurrentLocal } from "@/lib/locals-repository";

export const dynamic = "force-dynamic";

export default async function Local001Page() {
  const local001 = await getCurrentLocal();

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
          <span className="button" aria-disabled="true">
            Checkout Disabled
          </span>
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
