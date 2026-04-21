import { randomUUID } from "node:crypto";
import { ActionLogPhase, ActionState, HermesJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const runtimeControlId = "hermes-runtime-primary";
const defaultHeartbeatIntervalSeconds = 300;
const defaultAgentName = "hermes";

export type HermesRuntimeSnapshot = {
  runtimeState: string;
  runtimeEnabled: boolean;
  killSwitch: string;
  killSwitchActive: boolean;
  queue: string;
  heartbeatState: string;
  heartbeatIntervalSeconds: number;
  lastHeartbeat: string;
  lastHeartbeatAt: string | null;
  lastJob: string;
};

type HermesJobConfig<T> = {
  jobName: string;
  actionClass: string;
  platform: string;
  targetSurface: string;
  requestId?: string;
  localId?: number;
  approvalId?: string;
  affectedObject?: string;
  publicUrl?: string;
  retryBudget?: number;
  allowWhenKillSwitchActive?: boolean;
  agentName?: string;
  summarizeFailure?: (error: unknown) => string;
  summarizeSuccess?: (result: T) => string;
};

type HermesJobContext = {
  agentName: string;
  jobId: string;
  requestId: string;
};

function databaseReadsEnabled() {
  return process.env.ENABLE_DATABASE_READS === "true" && Boolean(process.env.DATABASE_URL);
}

function envFlag(name: string, defaultValue: boolean) {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  return value === "true";
}

function configuredAgentName() {
  const raw = process.env.HERMES_AGENT_NAME?.trim();
  return raw || defaultAgentName;
}

export function hermesRuntimeEnabled() {
  return envFlag("HERMES_RUNTIME_ENABLED", true);
}

export function hermesKillSwitchEnvActive() {
  return envFlag("HERMES_KILL_SWITCH", false);
}

export function hermesHeartbeatIntervalSeconds() {
  const raw = process.env.HERMES_HEARTBEAT_INTERVAL_SECONDS?.trim();

  if (!raw) {
    return defaultHeartbeatIntervalSeconds;
  }

  const seconds = Number.parseInt(raw, 10);

  if (!Number.isFinite(seconds) || seconds < 30 || seconds > 3600) {
    return defaultHeartbeatIntervalSeconds;
  }

  return seconds;
}

async function ensureRuntimeControlRecord() {
  if (!databaseReadsEnabled()) {
    return null;
  }

  return prisma.hermesRuntimeControl.upsert({
    where: { id: runtimeControlId },
    update: {
      runtimeEnabled: hermesRuntimeEnabled(),
      heartbeatIntervalSeconds: hermesHeartbeatIntervalSeconds(),
    },
    create: {
      id: runtimeControlId,
      runtimeEnabled: hermesRuntimeEnabled(),
      heartbeatIntervalSeconds: hermesHeartbeatIntervalSeconds(),
      queueState: "idle",
    },
  });
}

function jobSummaryFromRecord(job: {
  jobName: string;
  status: string;
  summary: string | null;
}) {
  return job.summary ? `${job.jobName} (${job.status.toLowerCase()}): ${job.summary}` : `${job.jobName} (${job.status.toLowerCase()})`;
}

function heartbeatStateFromRecord(input: {
  intervalSeconds: number;
  lastHeartbeatAt: Date | null;
  runtimeEnabled: boolean;
}) {
  if (!input.runtimeEnabled) {
    return "disabled";
  }

  if (!input.lastHeartbeatAt) {
    return "missing";
  }

  const ageMs = Date.now() - input.lastHeartbeatAt.getTime();

  if (ageMs <= input.intervalSeconds * 2000) {
    return "healthy";
  }

  return "stale";
}

function fallbackSnapshot(): HermesRuntimeSnapshot {
  return {
    runtimeState: hermesRuntimeEnabled() ? "bootstrap" : "disabled",
    runtimeEnabled: hermesRuntimeEnabled(),
    killSwitch: hermesKillSwitchEnvActive() ? "active" : "inactive",
    killSwitchActive: hermesKillSwitchEnvActive(),
    queue: "offline",
    heartbeatState: hermesRuntimeEnabled() ? "missing" : "disabled",
    heartbeatIntervalSeconds: hermesHeartbeatIntervalSeconds(),
    lastHeartbeat: "Not recorded",
    lastHeartbeatAt: null,
    lastJob: "No Hermes jobs recorded.",
  };
}

async function setQueueState(queueState: string, lastError?: string | null) {
  if (!databaseReadsEnabled()) {
    return;
  }

  await prisma.hermesRuntimeControl.update({
    where: { id: runtimeControlId },
    data: {
      queueState,
      ...(lastError === undefined ? {} : { lastError }),
      lastHeartbeatAt: new Date(),
    },
  });
}

async function createActionLogEntry(input: {
  requestId: string;
  phase: ActionLogPhase;
  agentName: string;
  jobRunId?: string;
  localId?: number;
  actionClass: string;
  platform: string;
  affectedObject?: string;
  approvalId?: string;
  publicUrl?: string;
  state: ActionState;
  summary: string;
}) {
  if (!databaseReadsEnabled()) {
    return;
  }

  await prisma.actionLog.create({
    data: {
      id: `alog_${randomUUID()}`,
      localId: input.localId,
      jobRunId: input.jobRunId,
      timestamp: new Date(),
      phase: input.phase,
      agentName: input.agentName,
      actionClass: input.actionClass,
      requestId: input.requestId,
      platform: input.platform,
      affectedObject: input.affectedObject,
      approvalId: input.approvalId,
      publicUrl: input.publicUrl,
      state: input.state,
      summary: input.summary,
    },
  });
}

function blockedSummary(error: HermesRuntimeError) {
  return error.message;
}

export class HermesRuntimeError extends Error {
  constructor(
    message: string,
    readonly code = "hermes_runtime_error",
    readonly status = 503,
  ) {
    super(message);
    this.name = "HermesRuntimeError";
  }
}

export async function recordHermesHeartbeat(input?: {
  lastError?: string | null;
  queueState?: string;
  runtimeEnabled?: boolean;
}) {
  if (!databaseReadsEnabled()) {
    return fallbackSnapshot();
  }

  const control = await prisma.hermesRuntimeControl.upsert({
    where: { id: runtimeControlId },
    update: {
      runtimeEnabled: input?.runtimeEnabled ?? hermesRuntimeEnabled(),
      queueState: input?.queueState,
      lastError: input?.lastError,
      heartbeatIntervalSeconds: hermesHeartbeatIntervalSeconds(),
      lastHeartbeatAt: new Date(),
    },
    create: {
      id: runtimeControlId,
      runtimeEnabled: input?.runtimeEnabled ?? hermesRuntimeEnabled(),
      queueState: input?.queueState ?? "idle",
      lastError: input?.lastError ?? null,
      heartbeatIntervalSeconds: hermesHeartbeatIntervalSeconds(),
      lastHeartbeatAt: new Date(),
    },
  });

  const latestJob = await prisma.hermesJobRun.findFirst({
    orderBy: [{ requestedAt: "desc" }],
  });

  const effectiveKillSwitch = control.killSwitchActive || hermesKillSwitchEnvActive();
  const heartbeatState = heartbeatStateFromRecord({
    intervalSeconds: control.heartbeatIntervalSeconds,
    lastHeartbeatAt: control.lastHeartbeatAt,
    runtimeEnabled: control.runtimeEnabled,
  });

  return {
    runtimeState: !control.runtimeEnabled ? "disabled" : effectiveKillSwitch ? "killed" : heartbeatState,
    runtimeEnabled: control.runtimeEnabled,
    killSwitch: effectiveKillSwitch ? "active" : "inactive",
    killSwitchActive: effectiveKillSwitch,
    queue: control.queueState,
    heartbeatState,
    heartbeatIntervalSeconds: control.heartbeatIntervalSeconds,
    lastHeartbeat: control.lastHeartbeatAt?.toISOString() ?? "Not recorded",
    lastHeartbeatAt: control.lastHeartbeatAt?.toISOString() ?? null,
    lastJob: latestJob ? jobSummaryFromRecord(latestJob) : "No Hermes jobs recorded.",
  } satisfies HermesRuntimeSnapshot;
}

export async function getHermesRuntimeSnapshot(): Promise<HermesRuntimeSnapshot> {
  if (!databaseReadsEnabled()) {
    return fallbackSnapshot();
  }

  const control = await ensureRuntimeControlRecord();

  if (!control) {
    return fallbackSnapshot();
  }

  const latestJob = await prisma.hermesJobRun.findFirst({
    orderBy: [{ requestedAt: "desc" }],
  });

  const effectiveKillSwitch = control.killSwitchActive || hermesKillSwitchEnvActive();
  const heartbeatState = heartbeatStateFromRecord({
    intervalSeconds: control.heartbeatIntervalSeconds,
    lastHeartbeatAt: control.lastHeartbeatAt,
    runtimeEnabled: control.runtimeEnabled,
  });

  return {
    runtimeState: !control.runtimeEnabled
      ? "disabled"
      : effectiveKillSwitch
        ? "killed"
        : latestJob
          ? "active"
          : "bootstrap",
    runtimeEnabled: control.runtimeEnabled,
    killSwitch: effectiveKillSwitch ? "active" : "inactive",
    killSwitchActive: effectiveKillSwitch,
    queue: control.queueState,
    heartbeatState,
    heartbeatIntervalSeconds: control.heartbeatIntervalSeconds,
    lastHeartbeat: control.lastHeartbeatAt?.toISOString() ?? "Not recorded",
    lastHeartbeatAt: control.lastHeartbeatAt?.toISOString() ?? null,
    lastJob: latestJob ? jobSummaryFromRecord(latestJob) : "No Hermes jobs recorded.",
  };
}

export async function runHermesJob<T>(
  config: HermesJobConfig<T>,
  work: (context: HermesJobContext) => Promise<T>,
): Promise<T> {
  const requestId = config.requestId ?? `req_${randomUUID()}`;
  const jobId = `hj_${randomUUID()}`;
  const agentName = config.agentName ?? configuredAgentName();

  if (!databaseReadsEnabled()) {
    if (!hermesRuntimeEnabled()) {
      throw new HermesRuntimeError("Hermes runtime is disabled.", "hermes_runtime_disabled");
    }

    if (!config.allowWhenKillSwitchActive && hermesKillSwitchEnvActive()) {
      throw new HermesRuntimeError("Hermes kill switch is active.", "hermes_kill_switch");
    }

    return work({ agentName, jobId, requestId });
  }

  const control = await ensureRuntimeControlRecord();

  if (!control) {
    throw new HermesRuntimeError("Hermes runtime control record is unavailable.", "hermes_runtime_missing");
  }

  await prisma.hermesJobRun.create({
    data: {
      id: jobId,
      localId: config.localId,
      jobName: config.jobName,
      agentName,
      actionClass: config.actionClass,
      targetSurface: config.targetSurface,
      platform: config.platform,
      requestId,
      approvalId: config.approvalId,
      affectedObject: config.affectedObject,
      publicUrl: config.publicUrl,
      status: HermesJobStatus.QUEUED,
      retryBudget: config.retryBudget ?? 0,
    },
  });

  await createActionLogEntry({
    requestId,
    phase: ActionLogPhase.BEFORE,
    agentName,
    jobRunId: jobId,
    localId: config.localId,
    actionClass: config.actionClass,
    platform: config.platform,
    affectedObject: config.affectedObject,
    approvalId: config.approvalId,
    publicUrl: config.publicUrl,
    state: ActionState.SUCCESS,
    summary: `Hermes accepted ${config.jobName} for ${config.targetSurface}.`,
  });

  const blockedReason = !control.runtimeEnabled
    ? new HermesRuntimeError("Hermes runtime is disabled by control plane.", "hermes_runtime_disabled")
    : !config.allowWhenKillSwitchActive && (control.killSwitchActive || hermesKillSwitchEnvActive())
      ? new HermesRuntimeError("Hermes kill switch is active.", "hermes_kill_switch")
      : null;

  if (blockedReason) {
    await prisma.hermesJobRun.update({
      where: { id: jobId },
      data: {
        status: HermesJobStatus.BLOCKED,
        finishedAt: new Date(),
        errorMessage: blockedReason.message,
        summary: blockedSummary(blockedReason),
      },
    });

    await createActionLogEntry({
      requestId,
      phase: ActionLogPhase.AFTER,
      agentName,
      jobRunId: jobId,
      localId: config.localId,
      actionClass: config.actionClass,
      platform: config.platform,
      affectedObject: config.affectedObject,
      approvalId: config.approvalId,
      publicUrl: config.publicUrl,
      state: ActionState.FAILURE,
      summary: blockedSummary(blockedReason),
    });

    await setQueueState("needs_review", blockedReason.message);
    throw blockedReason;
  }

  await prisma.hermesJobRun.update({
    where: { id: jobId },
    data: {
      status: HermesJobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  await setQueueState("active", null);

  try {
    const result = await work({ agentName, jobId, requestId });
    const summary = config.summarizeSuccess?.(result) ?? `${config.jobName} completed successfully.`;

    await prisma.hermesJobRun.update({
      where: { id: jobId },
      data: {
        status: HermesJobStatus.SUCCESS,
        finishedAt: new Date(),
        summary,
        errorMessage: null,
      },
    });

    await createActionLogEntry({
      requestId,
      phase: ActionLogPhase.AFTER,
      agentName,
      jobRunId: jobId,
      localId: config.localId,
      actionClass: config.actionClass,
      platform: config.platform,
      affectedObject: config.affectedObject,
      approvalId: config.approvalId,
      publicUrl: config.publicUrl,
      state: ActionState.SUCCESS,
      summary,
    });

    await setQueueState("idle", null);
    return result;
  } catch (error) {
    const summary = config.summarizeFailure?.(error) ?? (error instanceof Error ? error.message : "Hermes job failed.");
    const status = error instanceof HermesRuntimeError ? HermesJobStatus.BLOCKED : HermesJobStatus.FAILURE;

    await prisma.hermesJobRun.update({
      where: { id: jobId },
      data: {
        status,
        finishedAt: new Date(),
        summary,
        errorMessage: summary,
      },
    });

    await createActionLogEntry({
      requestId,
      phase: ActionLogPhase.AFTER,
      agentName,
      jobRunId: jobId,
      localId: config.localId,
      actionClass: config.actionClass,
      platform: config.platform,
      affectedObject: config.affectedObject,
      approvalId: config.approvalId,
      publicUrl: config.publicUrl,
      state: ActionState.FAILURE,
      summary,
    });

    await setQueueState(status === HermesJobStatus.BLOCKED ? "needs_review" : "degraded", summary);
    throw error;
  }
}
