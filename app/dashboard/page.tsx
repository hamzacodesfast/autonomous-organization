import { getPublicDashboardSnapshot } from "@/lib/locals-repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboardSnapshot = await getPublicDashboardSnapshot();

  return (
    <section className="section">
      <p className="eyebrow">Public Dashboard</p>
      <h1>Operations Window</h1>
      <dl className="field-list">
        <dt>Current Local</dt>
        <dd>{dashboardSnapshot.currentLocal}</dd>
        <dt>Status</dt>
        <dd>{dashboardSnapshot.localStatus}</dd>
        <dt>Last Agent Action</dt>
        <dd>{dashboardSnapshot.lastAgentAction}</dd>
        <dt>Uptime</dt>
        <dd>{dashboardSnapshot.uptime}</dd>
        <dt>Orders Fulfilled This Month</dt>
        <dd>{dashboardSnapshot.fulfilledThisMonth}</dd>
      </dl>
    </section>
  );
}
