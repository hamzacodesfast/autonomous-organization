import { NextResponse } from "next/server";
import { getHermesRuntimeSnapshot } from "@/lib/hermes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hermes = await getHermesRuntimeSnapshot();

  return NextResponse.json({
    ok: true,
    service: "autonomous-organization",
    timestamp: new Date().toISOString(),
    hermes: {
      heartbeatState: hermes.heartbeatState,
      killSwitch: hermes.killSwitch,
      lastHeartbeatAt: hermes.lastHeartbeatAt,
      queue: hermes.queue,
      runtimeState: hermes.runtimeState,
    },
  });
}
