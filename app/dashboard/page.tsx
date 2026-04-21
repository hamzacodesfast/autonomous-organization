import { getHermesRuntimeSnapshot } from "@/lib/hermes";
import { getPublicDashboardSnapshot } from "@/lib/locals-repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboardSnapshot, hermesSnapshot] = await Promise.all([getPublicDashboardSnapshot(), getHermesRuntimeSnapshot()]);

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
      <h2>Hermes Runtime</h2>
      <dl className="field-list">
        <dt>Runtime State</dt>
        <dd>{hermesSnapshot.runtimeState}</dd>
        <dt>Queue</dt>
        <dd>{hermesSnapshot.queue}</dd>
        <dt>Kill Switch</dt>
        <dd>{hermesSnapshot.killSwitch}</dd>
        <dt>Heartbeat</dt>
        <dd>{hermesSnapshot.lastHeartbeat}</dd>
        <dt>Last Hermes Job</dt>
        <dd>{hermesSnapshot.lastJob}</dd>
      </dl>
    </section>
  );
}
