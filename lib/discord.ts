import nacl from "tweetnacl";

const discordApiBaseUrl = "https://discord.com/api/v10";
const ephemeralMessageFlag = 1 << 6;

type DiscordMessagePayload = {
  content?: string;
  embeds?: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
  allowed_mentions?: {
    parse: string[];
  };
  flags?: number;
};

type DiscordApprovalAction = "approve" | "reject";

const webhookEnvByKind = {
  alerts: "DISCORD_ALERTS_WEBHOOK_URL",
  opsLog: "DISCORD_OPS_LOG_WEBHOOK_URL",
  deploys: "DISCORD_DEPLOYS_WEBHOOK_URL",
  dropsPendingApproval: "DISCORD_DROPS_PENDING_APPROVAL_WEBHOOK_URL",
  customerEscalations: "DISCORD_CUSTOMER_ESCALATIONS_WEBHOOK_URL",
  postmortems: "DISCORD_POSTMORTEMS_WEBHOOK_URL",
} as const;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function isPlaceholder(value: string) {
  return !value || value.startsWith("PLACEHOLDER_") || value.startsWith("REPLACE_WITH_");
}

function webhookUrl(kind: keyof typeof webhookEnvByKind) {
  const value = env(webhookEnvByKind[kind]);
  return isPlaceholder(value) ? "" : value;
}

function discordPublicKey() {
  const value = env("DISCORD_PUBLIC_KEY");
  return isPlaceholder(value) ? "" : value;
}

function discordBotToken() {
  const value = env("DISCORD_BOT_TOKEN");
  return isPlaceholder(value) ? "" : value;
}

function discordApplicationId() {
  const value = env("DISCORD_APPLICATION_ID");
  return isPlaceholder(value) ? "" : value;
}

function discordApprovalsChannelId() {
  const value = env("DISCORD_APPROVALS_CHANNEL_ID");
  return isPlaceholder(value) ? "" : value;
}

function discordDropsPendingApprovalChannelId() {
  const value = env("DISCORD_DROPS_PENDING_APPROVAL_CHANNEL_ID");
  return isPlaceholder(value) ? "" : value;
}

function approverUserIds() {
  return env("DISCORD_APPROVER_USER_IDS")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && !isPlaceholder(value));
}

function approvalMessageAllowedMentions() {
  return { parse: [] as string[] };
}

async function postDiscordWebhook(url: string, payload: DiscordMessagePayload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      allowed_mentions: approvalMessageAllowedMentions(),
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook request failed with status ${response.status}.`);
  }
}

async function discordBotRequest(path: string, init: RequestInit) {
  const token = discordBotToken();

  if (!token) {
    throw new Error("Discord bot token is not configured.");
  }

  const response = await fetch(`${discordApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord bot API request failed with status ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function discordWebhookConfigured(kind: keyof typeof webhookEnvByKind) {
  return Boolean(webhookUrl(kind));
}

export function discordBotConfigured() {
  return Boolean(discordBotToken() && discordApplicationId() && discordPublicKey());
}

export function discordApprovalBotConfigured() {
  return Boolean(discordBotConfigured() && discordApprovalsChannelId() && discordDropsPendingApprovalChannelId());
}

export function configuredDiscordApproverUserIds() {
  return approverUserIds();
}

export function currentDiscordApplicationId() {
  return discordApplicationId();
}

export function currentDiscordApprovalsChannelId() {
  return discordApprovalsChannelId();
}

export function currentDiscordDropsPendingApprovalChannelId() {
  return discordDropsPendingApprovalChannelId();
}

export function verifyDiscordInteractionSignature(input: {
  body: string;
  signature: string | null;
  timestamp: string | null;
}) {
  const publicKey = discordPublicKey();

  if (!publicKey || !input.signature || !input.timestamp) {
    return false;
  }

  return nacl.sign.detached.verify(
    Buffer.from(input.timestamp + input.body),
    Buffer.from(input.signature, "hex"),
    Buffer.from(publicKey, "hex"),
  );
}

export function discordEphemeralResponse(content: string) {
  return {
    type: 4,
    data: {
      content,
      flags: ephemeralMessageFlag,
      allowed_mentions: approvalMessageAllowedMentions(),
    },
  };
}

export function buildDiscordApprovalCustomId(input: {
  requestId: string;
  action: DiscordApprovalAction;
}) {
  return `ao-approval:${input.requestId}:${input.action}`;
}

export function parseDiscordApprovalCustomId(customId: string) {
  const match = /^ao-approval:([^:]+):(approve|reject)$/.exec(customId);

  if (!match) {
    return null;
  }

  return {
    requestId: match[1],
    action: match[2] as DiscordApprovalAction,
  };
}

export function approvalRequestMessagePayload(input: {
  approvalRequestId: string;
  actionClass: string;
  platform: string;
  targetSurface: string;
  scope: string;
  localNumber?: string | null;
  affectedObject?: string | null;
  publicDestination?: string | null;
  requestedAtIso: string;
}) {
  const lines = [
    "Hermes requires human approval before proceeding.",
    `Approval request: ${input.approvalRequestId}`,
    `Action class: ${input.actionClass}`,
    `Platform: ${input.platform}`,
    `Target surface: ${input.targetSurface}`,
    `Scope: ${input.scope}`,
  ];

  if (input.localNumber) {
    lines.push(`Local: ${input.localNumber}`);
  }

  if (input.affectedObject) {
    lines.push(`Affected object: ${input.affectedObject}`);
  }

  if (input.publicDestination) {
    lines.push(`Public destination: ${input.publicDestination}`);
  }

  lines.push(`Requested at: ${input.requestedAtIso}`);

  return {
    content: lines.join("\n"),
    allowed_mentions: approvalMessageAllowedMentions(),
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "Approve",
            custom_id: buildDiscordApprovalCustomId({
              requestId: input.approvalRequestId,
              action: "approve",
            }),
          },
          {
            type: 2,
            style: 4,
            label: "Reject",
            custom_id: buildDiscordApprovalCustomId({
              requestId: input.approvalRequestId,
              action: "reject",
            }),
          },
        ],
      },
    ],
  } satisfies DiscordMessagePayload;
}

export function resolvedApprovalMessagePayload(input: {
  approvalRequestId: string;
  actionClass: string;
  platform: string;
  targetSurface: string;
  scope: string;
  localNumber?: string | null;
  affectedObject?: string | null;
  publicDestination?: string | null;
  requestedAtIso: string;
  status: "APPROVED" | "REJECTED";
  approvalId: string;
  resolvedByDiscordUsername: string;
  resolvedAtIso: string;
}) {
  const lines = [
    `Hermes ${input.status === "APPROVED" ? "received approval" : "received rejection"}.`,
    `Approval request: ${input.approvalRequestId}`,
    `Recorded decision ID: ${input.approvalId}`,
    `Action class: ${input.actionClass}`,
    `Platform: ${input.platform}`,
    `Target surface: ${input.targetSurface}`,
    `Scope: ${input.scope}`,
  ];

  if (input.localNumber) {
    lines.push(`Local: ${input.localNumber}`);
  }

  if (input.affectedObject) {
    lines.push(`Affected object: ${input.affectedObject}`);
  }

  if (input.publicDestination) {
    lines.push(`Public destination: ${input.publicDestination}`);
  }

  lines.push(`Requested at: ${input.requestedAtIso}`);
  lines.push(`Resolved by: ${input.resolvedByDiscordUsername}`);
  lines.push(`Resolved at: ${input.resolvedAtIso}`);

  return {
    content: lines.join("\n"),
    allowed_mentions: approvalMessageAllowedMentions(),
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: input.status === "APPROVED" ? 3 : 4,
            label: input.status === "APPROVED" ? "Approved" : "Rejected",
            custom_id: "ao-approval:resolved",
            disabled: true,
          },
        ],
      },
    ],
  } satisfies DiscordMessagePayload;
}

export async function sendDiscordAlert(content: string) {
  const url = webhookUrl("alerts");

  if (!url) {
    return false;
  }

  await postDiscordWebhook(url, { content });
  return true;
}

export async function sendDiscordOpsLog(content: string) {
  const url = webhookUrl("opsLog");

  if (!url) {
    return false;
  }

  await postDiscordWebhook(url, { content });
  return true;
}

export async function sendDiscordDeployNotice(content: string) {
  const url = webhookUrl("deploys");

  if (!url) {
    return false;
  }

  await postDiscordWebhook(url, { content });
  return true;
}

export async function sendDiscordCustomerEscalation(content: string) {
  const url = webhookUrl("customerEscalations");

  if (!url) {
    return false;
  }

  await postDiscordWebhook(url, { content });
  return true;
}

export async function sendDiscordPostmortemNotice(content: string) {
  const url = webhookUrl("postmortems");

  if (!url) {
    return false;
  }

  await postDiscordWebhook(url, { content });
  return true;
}

export async function sendDiscordPendingApprovalMirror(content: string) {
  const url = webhookUrl("dropsPendingApproval");

  if (!url) {
    return false;
  }

  await postDiscordWebhook(url, { content });
  return true;
}

export async function createDiscordChannelMessage(input: {
  channelId: string;
  payload: DiscordMessagePayload;
}) {
  const response = await discordBotRequest(`/channels/${input.channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: approvalMessageAllowedMentions(),
      ...input.payload,
    }),
  });

  return response as { id: string; channel_id: string };
}

export async function createDiscordApprovalRequestMessage(payload: DiscordMessagePayload) {
  const channelId = discordDropsPendingApprovalChannelId();

  if (!channelId) {
    throw new Error("Discord drops-pending-approval channel ID is not configured.");
  }

  return createDiscordChannelMessage({
    channelId,
    payload,
  });
}

export async function createDiscordApprovalLedgerMessage(payload: DiscordMessagePayload) {
  const channelId = discordApprovalsChannelId();

  if (!channelId) {
    throw new Error("Discord approvals channel ID is not configured.");
  }

  return createDiscordChannelMessage({
    channelId,
    payload,
  });
}
