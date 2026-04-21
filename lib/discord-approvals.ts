import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ActionState, ApprovalDecision, ApprovalRequestStatus, HermesJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  approvalRequestMessagePayload,
  configuredDiscordApproverUserIds,
  createDiscordApprovalLedgerMessage,
  createDiscordApprovalRequestMessage,
  discordApprovalBotConfigured,
  resolvedApprovalMessagePayload,
  sendDiscordAlert,
  sendDiscordOpsLog,
} from "@/lib/discord";

function databaseReadsEnabled() {
  return process.env.ENABLE_DATABASE_READS === "true" && Boolean(process.env.DATABASE_URL);
}

function approvalRequestSummary(input: {
  status: "APPROVED" | "REJECTED";
  approvalId: string;
  actor: string;
  requestId: string;
}) {
  const verb = input.status === "APPROVED" ? "approved" : "rejected";
  return `Discord approver ${input.actor} ${verb} request ${input.requestId} as ${input.approvalId}.`;
}

function parseApprovalNumericPart(id: string) {
  const match = /^AO-APPROVAL-(\d{4})$/.exec(id);
  return match ? Number.parseInt(match[1], 10) : null;
}

function formatApprovalId(sequence: number) {
  return `AO-APPROVAL-${String(sequence).padStart(4, "0")}`;
}

async function nextApprovalId() {
  const approvals = await prisma.approval.findMany({
    select: {
      id: true,
    },
  });

  const maxNumericId = approvals.reduce((max, approval) => {
    const numeric = parseApprovalNumericPart(approval.id);
    return numeric && numeric > max ? numeric : max;
  }, 0);

  return formatApprovalId(maxNumericId + 1);
}

async function currentSpecVersion() {
  const configuredPath = process.env.BRAND_SPEC_PATH?.trim() || "docs/AUTONOMOUS_ORGANIZATION_BRAND_SPEC.md";
  const absolutePath = path.resolve(process.cwd(), configuredPath);

  if (!fs.existsSync(absolutePath)) {
    return "v0.3";
  }

  const text = fs.readFileSync(absolutePath, "utf8");
  const match = /Current version:\s*(v\d+\.\d+)/.exec(text);

  return match?.[1] ?? "v0.3";
}

export type DiscordApprovalRequestInput = {
  requestId: string;
  localId?: number;
  jobRunId?: string;
  actionClass: string;
  platform: string;
  targetSurface: string;
  scope: string;
  specVersion?: string;
  publicDestination?: string;
  affectedObject?: string;
  requestedBy?: string;
  proposedApprovalId?: string;
  notes?: string;
};

export async function createDiscordApprovalRequest(input: DiscordApprovalRequestInput) {
  if (!databaseReadsEnabled()) {
    throw new Error("Database reads must be enabled to create a Discord approval request.");
  }

  if (!discordApprovalBotConfigured()) {
    throw new Error("Discord bot approval flow is not configured.");
  }

  const existing = await prisma.approvalRequest.findUnique({
    where: { requestId: input.requestId },
    include: {
      local: {
        select: {
          localNumber: true,
        },
      },
    },
  });

  if (existing?.status === ApprovalRequestStatus.APPROVED && existing.approvalId) {
    return {
      status: "approved" as const,
      approvalId: existing.approvalId,
      approvalRequest: existing,
    };
  }

  if (existing?.status === ApprovalRequestStatus.PENDING) {
    return {
      status: "pending" as const,
      approvalRequest: existing,
    };
  }

  const local = input.localId
    ? await prisma.local.findUnique({
        where: { id: input.localId },
        select: {
          id: true,
          localNumber: true,
        },
      })
    : null;

  const specVersion = input.specVersion ?? (await currentSpecVersion());

  const created = await prisma.approvalRequest.create({
    data: {
      id: `apr_${randomUUID()}`,
      localId: local?.id ?? null,
      jobRunId: input.jobRunId,
      requestId: input.requestId,
      actionClass: input.actionClass,
      platform: input.platform,
      targetSurface: input.targetSurface,
      scope: input.scope,
      specVersion,
      publicDestination: input.publicDestination,
      affectedObject: input.affectedObject,
      requestedBy: input.requestedBy ?? "hermes",
      proposedApprovalId: input.proposedApprovalId,
      notes: input.notes,
    },
    include: {
      local: {
        select: {
          localNumber: true,
        },
      },
    },
  });

  try {
    const message = await createDiscordApprovalRequestMessage(
      approvalRequestMessagePayload({
        approvalRequestId: created.id,
        actionClass: created.actionClass,
        platform: created.platform,
        targetSurface: created.targetSurface,
        scope: created.scope,
        localNumber: created.local?.localNumber ?? null,
        affectedObject: created.affectedObject,
        publicDestination: created.publicDestination,
        requestedAtIso: created.requestedAt.toISOString(),
      }),
    );

    const updated = await prisma.approvalRequest.update({
      where: { id: created.id },
      data: {
        discordChannelId: message.channel_id,
        discordMessageId: message.id,
      },
      include: {
        local: {
          select: {
            localNumber: true,
          },
        },
      },
    });

    void sendDiscordOpsLog(
      `Approval request opened: ${updated.id}\nAction class: ${updated.actionClass}\nPlatform: ${updated.platform}\nTarget surface: ${updated.targetSurface}`,
    ).catch(() => undefined);

    return {
      status: "pending" as const,
      approvalRequest: updated,
    };
  } catch (error) {
    await prisma.approvalRequest.update({
      where: { id: created.id },
      data: {
        status: ApprovalRequestStatus.CANCELLED,
        resolutionReason: error instanceof Error ? error.message : "Discord approval request message failed.",
        resolvedAt: new Date(),
      },
    });

    throw error;
  }
}

export async function resolveDiscordApprovalRequest(input: {
  approvalRequestId: string;
  action: "approve" | "reject";
  discordUserId: string;
  discordUsername: string;
}) {
  if (!databaseReadsEnabled()) {
    throw new Error("Database reads must be enabled to resolve a Discord approval request.");
  }

  const approverUserIds = configuredDiscordApproverUserIds();

  if (!approverUserIds.includes(input.discordUserId)) {
    return {
      kind: "not_authorized" as const,
    };
  }

  const approvalRequest = await prisma.approvalRequest.findUnique({
    where: { id: input.approvalRequestId },
    include: {
      local: {
        select: {
          localNumber: true,
        },
      },
    },
  });

  if (!approvalRequest) {
    return {
      kind: "not_found" as const,
    };
  }

  if (approvalRequest.status !== ApprovalRequestStatus.PENDING) {
    return {
      kind: "already_resolved" as const,
      approvalRequest,
    };
  }

  const decision = input.action === "approve" ? ApprovalDecision.APPROVED : ApprovalDecision.REJECTED;
  const status = input.action === "approve" ? "APPROVED" : "REJECTED";
  const approvalId = approvalRequest.proposedApprovalId || (await nextApprovalId());
  const summary = approvalRequestSummary({
    status,
    approvalId,
    actor: input.discordUsername,
    requestId: approvalRequest.requestId,
  });

  const resolved = await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.create({
      data: {
        id: approvalId,
        localId: approvalRequest.localId,
        approver: input.discordUsername,
        decision,
        sourceChannel: "Discord approvals interaction",
        scope: approvalRequest.scope,
        specVersion: approvalRequest.specVersion,
        approvedAt: new Date(),
        publicDestination: approvalRequest.publicDestination,
        linkedObjectIds: [
          approvalRequest.id,
          ...(approvalRequest.affectedObject ? [approvalRequest.affectedObject] : []),
        ],
        notes: approvalRequest.notes,
      },
    });

    const updatedRequest = await tx.approvalRequest.update({
      where: { id: approvalRequest.id },
      data: {
        status: input.action === "approve" ? ApprovalRequestStatus.APPROVED : ApprovalRequestStatus.REJECTED,
        resolutionReason: summary,
        resolvedAt: new Date(),
        resolvedByDiscordUserId: input.discordUserId,
        resolvedByDiscordUsername: input.discordUsername,
        approvalId,
      },
      include: {
        local: {
          select: {
            localNumber: true,
          },
        },
      },
    });

    if (approvalRequest.jobRunId) {
      await tx.hermesJobRun.update({
        where: { id: approvalRequest.jobRunId },
        data: {
          status: HermesJobStatus.BLOCKED,
          summary:
            input.action === "approve"
              ? `Discord approval recorded as ${approvalId}. Re-run the blocked job to continue.`
              : `Discord rejected the blocked job as ${approvalId}. Human revision is required.`,
          errorMessage:
            input.action === "approve"
              ? `Discord approval recorded as ${approvalId}.`
              : `Discord rejected the blocked job as ${approvalId}.`,
        },
      });
    }

    await tx.actionLog.create({
      data: {
        id: `alog_${randomUUID()}`,
        localId: approvalRequest.localId,
        jobRunId: approvalRequest.jobRunId,
        timestamp: new Date(),
        agentName: "discord-approver",
        actionClass: approvalRequest.actionClass,
        requestId: approvalRequest.requestId,
        platform: "Discord",
        affectedObject: approvalRequest.affectedObject,
        approvalId,
        publicUrl: approvalRequest.publicDestination,
        state: input.action === "approve" ? ActionState.SUCCESS : ActionState.FAILURE,
        summary,
      },
    });

    return {
      approval,
      approvalRequest: updatedRequest,
    };
  });

  void createDiscordApprovalLedgerMessage(
    resolvedApprovalMessagePayload({
      approvalRequestId: resolved.approvalRequest.id,
      actionClass: resolved.approvalRequest.actionClass,
      platform: resolved.approvalRequest.platform,
      targetSurface: resolved.approvalRequest.targetSurface,
      scope: resolved.approvalRequest.scope,
      localNumber: resolved.approvalRequest.local?.localNumber ?? null,
      affectedObject: resolved.approvalRequest.affectedObject,
      publicDestination: resolved.approvalRequest.publicDestination,
      requestedAtIso: resolved.approvalRequest.requestedAt.toISOString(),
      status,
      approvalId: resolved.approval.id,
      resolvedByDiscordUsername: input.discordUsername,
      resolvedAtIso: resolved.approval.approvedAt.toISOString(),
    }),
  ).catch(() => undefined);

  void sendDiscordOpsLog(summary).catch(() => undefined);

  if (input.action === "reject") {
    void sendDiscordAlert(summary).catch(() => undefined);
  }

  return {
    kind: "resolved" as const,
    approval: resolved.approval,
    approvalRequest: resolved.approvalRequest,
    messagePayload: resolvedApprovalMessagePayload({
      approvalRequestId: resolved.approvalRequest.id,
      actionClass: resolved.approvalRequest.actionClass,
      platform: resolved.approvalRequest.platform,
      targetSurface: resolved.approvalRequest.targetSurface,
      scope: resolved.approvalRequest.scope,
      localNumber: resolved.approvalRequest.local?.localNumber ?? null,
      affectedObject: resolved.approvalRequest.affectedObject,
      publicDestination: resolved.approvalRequest.publicDestination,
      requestedAtIso: resolved.approvalRequest.requestedAt.toISOString(),
      status,
      approvalId: resolved.approval.id,
      resolvedByDiscordUsername: input.discordUsername,
      resolvedAtIso: resolved.approval.approvedAt.toISOString(),
    }),
  };
}
