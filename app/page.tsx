import Image from "next/image";
import Link from "next/link";
import { dashboardSnapshot, local001 } from "@/lib/local-001";

export default function HomePage() {
  return (
    <>
      <section className="section product-grid">
        <div>
          <p className="eyebrow">Current Local</p>
          <h1>Local No. 001</h1>
        </div>
        <div className="product-copy">
          <span className="status">{local001.status}</span>
          <p>{local001.concept}</p>
          <ul className="metadata">
            <li>Edition: {local001.editionCount} units</li>
            <li>Price: {local001.price}</li>
            <li>Remaining: {local001.remainingCount}</li>
            <li>Launch: {local001.issueDate}</li>
          </ul>
          <Link className="button" href="/locals/001">
            View Record
          </Link>
        </div>
      </section>

      <section className="section mockup-grid" aria-label="Local No. 001 mockups">
        <Image
          className="mockup"
          src={local001.backMockup}
          width={2048}
          height={2048}
          alt="Back mockup of Local No. 001 black tee"
          priority
        />
        <Image
          className="mockup"
          src={local001.frontMockup}
          width={2048}
          height={2048}
          alt="Front mockup of Local No. 001 black tee"
          priority
        />
      </section>

      <section className="section">
        <h2>Public Dashboard</h2>
        <dl className="field-list">
          <dt>Current Local</dt>
          <dd>{dashboardSnapshot.currentLocal}</dd>
          <dt>Status</dt>
          <dd>{dashboardSnapshot.localStatus}</dd>
          <dt>Last Action</dt>
          <dd>{dashboardSnapshot.lastAgentAction}</dd>
          <dt>Uptime</dt>
          <dd>{dashboardSnapshot.uptime}</dd>
          <dt>Fulfilled This Month</dt>
          <dd>{dashboardSnapshot.fulfilledThisMonth}</dd>
        </dl>
      </section>
    </>
  );
}
