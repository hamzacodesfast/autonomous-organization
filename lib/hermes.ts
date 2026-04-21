import { randomUUID } from "node:crypto";
import { ActionLogPhase, ActionState, ApprovalRequestStatus, HermesJobStatus } from "@prisma/client";
import { createDiscordApprovalRequest } from "@/lib/discord-approvals";
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

type HermesJobApprovalConfig = {
  scope: string;
  requestedBy?: string;
  proposedApprovalId?: string;
  notes?: string;
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
  approval?: HermesJobApprovalConfig;
  summarizeFailure?: (error: unknown) => string;
  summarizeSuccess?: (result: T) => string;
};

type HermesJobContext = {
  agentName: string;
  jobId: string;
  requestId: string;
  approvalId?: string;
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

function approvalExpired(expiresAt: Date | null) {
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

async function validateApprovalRecord(input: {
  approvalId: string;
  scope: string;
  localId?: number;
  publicUrl?: string;
}) {
  const approval = await prisma.approval.findUnique({
    where: { id: input.approvalId },
  });

  if (!approval) {
    throw new HermesRuntimeError(
      `Approval ${input.approvalId} was not found.`,
      "hermes_approval_missing",
      409,
    );
  }

  if (approval.decision !== "APPROVED") {
    throw new HermesRuntimeError(
      `Approval ${input.approvalId} is ${approval.decision.toLowerCase()}.`,
      "hermes_approval_not_approved",
      409,
    );
  }

  if (approvalExpired(approval.expiresAt)) {
    throw new HermesRuntimeError(
      `Approval ${input.approvalId} has expired.`,
      "hermes_approval_expired",
      409,
    );
  }

  if (approval.scope !== input.scope) {
    throw new HermesRuntimeError(
      `Approval ${input.approvalId} does not match the required scope.`,
      "hermes_approval_scope_mismatch",
      409,
    );
  }

  if (input.localId && approval.localId && approval.localId !== input.localId) {
    throw new HermesRuntimeError(
      `Approval ${input.approvalId} is attached to a different Local.`,
      "hermes_approval_local_mismatch",
      409,
    );
  }

  if (input.publicUrl && approval.publicDestination && approval.publicDestination !== input.publicUrl) {
    throw new HermesRuntimeError(
      `Approval ${input.approvalId} does not match the required public destination.`,
      "hermes_approval_destination_mismatch",
      409,
    );
  }

  return approval.id;
}

async function resolveHermesApproval(input: {
  requestId: string;
  jobId: string;
  agentName: string;
  config: Pick<
    HermesJobConfig<unknown>,
    "actionClass" | "platform" | "targetSurface" | "localId" | "approvalId" | "affectedObject" | "publicUrl" | "approval"
  >;
}) {
  if (!input.config.approval) {
    return input.config.approvalId;
  }

  if (!databaseReadsEnabled()) {
    if (input.config.approvalId) {
      return input.config.approvalId;
    }

    throw new HermesRuntimeError(
      "Hermes cannot request human approval while database reads are disabled.",
      "hermes_approval_unavailable",
      409,
    );
  }

  if (input.config.approvalId) {
    return validateApprovalRecord({
      approvalId: input.config.approvalId,
      scope: input.config.approval.scope,
      localId: input.config.localId,
      publicUrl: input.config.publicUrl,
    });
  }

  const existingRequest = await prisma.approvalRequest.findUnique({
    where: { requestId: input.requestId },
  });

  if (existingRequest?.status === ApprovalRequestStatus.APPROVED && existingRequest.approvalId) {
    return validateApprovalRecord({
      approvalId: existingRequest.approvalId,
      scope: input.config.approval.scope,
      localId: input.config.localId,
      publicUrl: input.config.publicUrl,
    });
  }

  if (existingRequest?.status === ApprovalRequestStatus.PENDING) {
    throw new HermesRuntimeError(
      `Human approval is pending in Discord for request ${existingRequest.id}.`,
      "hermes_approval_pending",
      409,
    );
  }

  if (existingRequest?.status === ApprovalRequestStatus.REJECTED) {
    throw new HermesRuntimeError(
      `Discord rejected request ${existingRequest.id}. Revise the action before re-requesting approval.`,
      "hermes_approval_rejected",
      409,
    );
  }

  if (existingRequest) {
    throw new HermesRuntimeError(
      `Discord approval request ${existingRequest.id} is ${existingRequest.status.toLowerCase()}. Re-run with a new request ID after fixing the underlying issue.`,
      "hermes_approval_unavailable",
      409,
    );
  }

  const created = await createDiscordApprovalRequest({
    requestId: input.requestId,
    jobRunId: input.jobId,
    localId: input.config.localId,
    actionClass: input.config.actionClass,
    platform: input.config.platform,
    targetSurface: input.config.targetSurface,
    scope: input.config.approval.scope,
    publicDestination: input.config.publicUrl,
    affectedObject: input.config.affectedObject,
    requestedBy: input.config.approval.requestedBy ?? input.agentName,
    proposedApprovalId: input.config.approval.proposedApprovalId,
    notes: input.config.approval.notes,
  });

  if (created.status === "approved") {
    return validateApprovalRecord({
      approvalId: created.approvalId,
      scope: input.config.approval.scope,
      localId: input.config.localId,
      publicUrl: input.config.publicUrl,
    });
  }

  throw new HermesRuntimeError(
    `Human approval required. Review request ${created.approvalRequest.id} in Discord #drops-pending-approval.`,
    "hermes_approval_required",
    409,
  );
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
  let effectiveApprovalId = config.approvalId;

  if (!databaseReadsEnabled()) {
    if (!hermesRuntimeEnabled()) {
      throw new HermesRuntimeError("Hermes runtime is disabled.", "hermes_runtime_disabled");
    }

    if (!config.allowWhenKillSwitchActive && hermesKillSwitchEnvActive()) {
      throw new HermesRuntimeError("Hermes kill switch is active.", "hermes_kill_switch");
    }

    return work({ agentName, jobId, requestId, approvalId: effectiveApprovalId });
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

  let approvalBlockedReason: HermesRuntimeError | null = null;

  if (!blockedReason) {
    try {
      effectiveApprovalId = await resolveHermesApproval({
        requestId,
        jobId,
        agentName,
        config,
      });
    } catch (error) {
      approvalBlockedReason =
        error instanceof HermesRuntimeError
          ? error
          : new HermesRuntimeError(
              error instanceof Error ? error.message : "Hermes could not initialize the Discord approval flow.",
              "hermes_approval_setup_error",
            );
    }
  }

  const runtimeBlockedReason = blockedReason ?? approvalBlockedReason;

  if (runtimeBlockedReason) {
    await prisma.hermesJobRun.update({
      where: { id: jobId },
      data: {
        status: HermesJobStatus.BLOCKED,
        finishedAt: new Date(),
        approvalId: effectiveApprovalId,
        errorMessage: runtimeBlockedReason.message,
        summary: blockedSummary(runtimeBlockedReason),
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
      approvalId: effectiveApprovalId,
      publicUrl: config.publicUrl,
      state: ActionState.FAILURE,
      summary: blockedSummary(runtimeBlockedReason),
    });

    await setQueueState("needs_review", runtimeBlockedReason.message);
    throw runtimeBlockedReason;
  }

  await prisma.hermesJobRun.update({
    where: { id: jobId },
    data: {
      status: HermesJobStatus.RUNNING,
      startedAt: new Date(),
      approvalId: effectiveApprovalId,
    },
  });

  await setQueueState("active", null);

  try {
    const result = await work({ agentName, jobId, requestId, approvalId: effectiveApprovalId });
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
      approvalId: effectiveApprovalId,
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
      approvalId: effectiveApprovalId,
      publicUrl: config.publicUrl,
      state: ActionState.FAILURE,
      summary,
    });

    await setQueueState(status === HermesJobStatus.BLOCKED ? "needs_review" : "degraded", summary);
    throw error;
  }
}
