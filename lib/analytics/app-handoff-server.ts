import "server-only";

import { capturePostHogEvent } from "@/lib/posthog-server";
import { createServiceRoleClient } from "@/lib/supabase";

interface LogArgs {
  sessionId: string;
  metadata: Record<string, unknown>;
}

/** Fire-and-await insert of an anonymous app_handoff_link_opened event from a
 * server route, before issuing a redirect. Never throws: logging failure must
 * not block the handoff. */
export async function logAppHandoffLinkOpenedServer({
  sessionId,
  metadata,
}: LogArgs): Promise<void> {
  try {
    const serviceClient = createServiceRoleClient();
    const { error } = await serviceClient.from("user_events").insert({
      user_id: null as never,
      session_id: sessionId,
      event_type: "app_handoff_link_opened",
      beach_id: null,
      metadata,
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
      ...(webDistinctId ? {} : { "$process_person_profile": false }),
    },
  });
}
