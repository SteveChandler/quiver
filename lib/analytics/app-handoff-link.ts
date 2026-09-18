import {
  buildAppHandoffUrl,
  type HandoffParams,
} from "@/lib/constants/app-handoff";
import { getClientPostHogDistinctId } from "@/lib/posthog-client";

export function createClientAppHandoffLink(
  params: HandoffParams,
): { handoffId: string; url: string; webDistinctId?: string } {
  const handoffId = crypto.randomUUID();
  const webDistinctId = getClientPostHogDistinctId();

  return {
    handoffId,
    webDistinctId,
    url: buildAppHandoffUrl({
      ...params,
      handoff_id: handoffId,
      ...(webDistinctId ? { web_distinct_id: webDistinctId } : {}),
    }),
  };
}
