import { NextResponse } from "next/server";
import { discordEphemeralResponse, parseDiscordApprovalCustomId, verifyDiscordInteractionSignature } from "@/lib/discord";
import { resolveDiscordApprovalRequest } from "@/lib/discord-approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscordInteraction = {
  type: number;
  data?: {
    custom_id?: string;
    name?: string;
  };
  user?: {
    id: string;
    username: string;
  };
  member?: {
    user?: {
      id: string;
      username: string;
    };
  };
};

function interactionActor(interaction: DiscordInteraction) {
  return interaction.member?.user ?? interaction.user ?? null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!verifyDiscordInteractionSignature({ body: rawBody, signature, timestamp })) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  if (interaction.type !== 3 || !interaction.data?.custom_id) {
    return NextResponse.json(discordEphemeralResponse("This Discord interaction is not supported by Hermes yet."));
  }

  const approvalAction = parseDiscordApprovalCustomId(interaction.data.custom_id);

  if (!approvalAction) {
    return NextResponse.json(discordEphemeralResponse("Hermes could not recognize this approval control."));
  }

  const actor = interactionActor(interaction);

  if (!actor) {
    return NextResponse.json(discordEphemeralResponse("Hermes could not identify the Discord user for this interaction."));
  }

  try {
    const result = await resolveDiscordApprovalRequest({
      approvalRequestId: approvalAction.requestId,
      action: approvalAction.action,
      discordUserId: actor.id,
      discordUsername: actor.username,
    });

    if (result.kind === "not_authorized") {
      return NextResponse.json(discordEphemeralResponse("You are not an authorized approver for Hermes actions."));
    }

    if (result.kind === "not_found") {
      return NextResponse.json(discordEphemeralResponse("Hermes could not find that approval request."));
    }

    if (result.kind === "already_resolved") {
      return NextResponse.json(
        discordEphemeralResponse(
          `That approval request is already ${result.approvalRequest.status.toLowerCase()}.`,
        ),
      );
    }

    return NextResponse.json({
      type: 7,
      data: result.messagePayload,
    });
  } catch (error) {
    console.error("Discord interaction processing failed", error);
    return NextResponse.json(
      discordEphemeralResponse("Hermes failed to process this approval interaction. Check #alerts."),
    );
  }
}
