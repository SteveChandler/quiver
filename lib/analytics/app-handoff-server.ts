import "server-only";

import { capturePostHogEvent } from "@/lib/posthog-server";
import { createServiceRoleClient } from "@/lib/supabase";

interface LogArgs {
  sessionId: string;
  metadata: Record<string, unknown>;
  /** True only for clear non-human hits; downstream views already exclude it. */
  botFlagged?: boolean;
}

/** Fire-and-await insert of an anonymous app_handoff_link_opened event from a
 * server route, before issuing a redirect. Never throws: logging failure must
 * not block the handoff. The row is a route hit, not a tap: flagged traffic is
 * still stored (so bot volume stays measurable) but marked bot_flagged. The
 * PostHog event keeps its name so existing insights keep receiving it; they
 * can filter on traffic_class. */
export async function logAppHandoffLinkOpenedServer({
  sessionId,
  metadata,
  botFlagged,
}: LogArgs): Promise<void> {
  try {
    const serviceClient = createServiceRoleClient();
    const { error } = await serviceClient.from("user_events").insert({
      user_id: null as never,
      session_id: sessionId,
      event_type: "app_handoff_link_opened",
      beach_id: null,
      metadata,
      ...(botFlagged === undefined ? {} : { bot_flagged: botFlagged }),
    } as never);

    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("app_handoff_link_opened insert failed:", message);
    }
  } catch (error) {
    console.error("app_handoff_link_opened insert threw:", error);
  }

  const webDistinctId =
    typeof metadata.web_distinct_id === "string"
      ? metadata.web_distinct_id
      : undefined;
  const { web_distinct_id: _webDistinctId, ...properties } = metadata;
  await capturePostHogEvent({
    distinctId: webDistinctId ?? sessionId,
    event: "app_handoff_link_opened",
    properties: {
      ...properties,
      ...(botFlagged === undefined ? {} : { bot_flagged: botFlagged }),
      ...(webDistinctId ? {} : { "$process_person_profile": false }),
    },
  });
}
