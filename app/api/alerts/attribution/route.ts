import {
  createErrorResponse,
  createSuccessResponse,
  withNoStore,
  withProtection,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { getOwnAnalyticsTrackingAllowed } from "@/lib/analytics/consent";
import { ALERT_ATTRIBUTION_EVENT_TYPES } from "@/lib/analytics/event-taxonomy";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validation";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const CHANNELS = new Set(["push", "email"] as const);
const ACTIONS = new Set([
  "watch_call",
  "log_session",
  "open_weekend_pick",
] as const);

type DeliveryChannel = "push" | "email";
type AttributionStage = keyof typeof ALERT_ATTRIBUTION_EVENT_TYPES;
type DecisionAction = "watch_call" | "log_session" | "open_weekend_pick";

interface AttributionBody {
  message_instance_id?: unknown;
  delivery_channel?: unknown;
  stage?: unknown;
  action?: unknown;
}

interface StoredMessage {
  notificationType: string;
  beachId: string | null;
}

async function resolveStoredMessage(
  userId: string,
  messageInstanceId: string,
  deliveryChannel: DeliveryChannel,
): Promise<StoredMessage | null> {
  const serviceClient = await createSupabaseServiceRoleClient();
  const client = serviceClient as any;

  const { data: attempt, error: attemptError } = await client
    .from("alert_delivery_attempts")
    .select("user_id")
    .eq("message_instance_id", messageInstanceId)
    .eq("user_id", userId)
    .eq("channel", deliveryChannel)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt) return null;

  if (deliveryChannel === "push") {
    const { data, error } = await client
      .from("notification_events")
      .select("recipient_user_id, type, entity_type, entity_id")
      .eq("id", messageInstanceId)
      .eq("recipient_user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      notificationType: data.type,
      beachId:
        data.entity_type === "beach" && isValidUUID(data.entity_id)
          ? data.entity_id
          : null,
    };
  }

  const { data, error } = await client
    .from("email_send_log")
    .select("user_id, email_type, best_beach_id")
    .eq("message_instance_id", messageInstanceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { notificationType: "conditions_alert", beachId: null };
  }

  return {
    notificationType: data.email_type,
    beachId: isValidUUID(data.best_beach_id) ? data.best_beach_id : null,
  };
}

export const POST = withNoStore(withProtection(async (
  request: NextRequest,
  { user, supabase }: AuthenticatedContext,
) => {
  let body: AttributionBody;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", undefined, 400);
  }

  const messageInstanceId = body.message_instance_id;
  const deliveryChannel = body.delivery_channel;
  const stage = body.stage;
  const action = body.action;

  if (
    typeof deliveryChannel !== "string"
    || !CHANNELS.has(deliveryChannel as DeliveryChannel)
    || typeof stage !== "string"
    || !Object.prototype.hasOwnProperty.call(ALERT_ATTRIBUTION_EVENT_TYPES, stage)
    || (action !== undefined
      && (typeof action !== "string" || !ACTIONS.has(action as DecisionAction)))
    || (stage === "decision_action" && action === undefined)
  ) {
    return createErrorResponse("Invalid attribution payload", undefined, 400);
  }

  if (typeof messageInstanceId !== "string" || !isValidUUID(messageInstanceId)) {
    return createSuccessResponse({ ok: true });
  }

  if (!(await getOwnAnalyticsTrackingAllowed(supabase, user.id))) {
    return createSuccessResponse({ ok: true });
  }

  const storedMessage = await resolveStoredMessage(
    user.id,
    messageInstanceId,
    deliveryChannel as DeliveryChannel,
  );
  if (!storedMessage) return createSuccessResponse({ ok: true });

  const eventType = ALERT_ATTRIBUTION_EVENT_TYPES[stage as AttributionStage];
  const { error } = await supabase.from("user_events").insert({
    user_id: user.id,
    event_type: eventType,
    beach_id: storedMessage.beachId,
    metadata: {
      message_instance_id: messageInstanceId,
      delivery_channel: deliveryChannel,
      notification_type: storedMessage.notificationType,
      ...(eventType === "alert_decision_action"
        ? { action: action as DecisionAction }
        : {}),
    },
  });
  if (error && error.code !== "23505") {
    return createErrorResponse("Failed to record attribution", undefined, 500);
  }

  return createSuccessResponse({ ok: true });
}, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" },
}));
