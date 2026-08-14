import type { Json } from "@/types/database";
import type { SupabaseServiceClient } from "@/types/supabase";

const SYSTEM_FEED_INSERT_FUNCTION = "try_insert_system_feed_post";

export interface SystemFeedPostInput {
  userId: string;
  beachId: string;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  dedupeHash: string | null;
  surfConditions: Json | null;
  expiresAt: string | null;
  createdAt: string;
}

export type SystemFeedPostStatus =
  | "inserted"
  | "duplicate"
  | "daily_cap"
  | "beach_daily_cap"
  | "beach_weekly_cap";

export interface SystemFeedPostResult {
  postId: string | null;
  status: SystemFeedPostStatus;
}

interface SystemFeedRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * The SQL function takes an advisory lock, counts the system-authored feed,
 * and inserts under that same lock. Direct intel_posts inserts would make the
 * cap advisory again when two cron invocations overlap.
 */
export async function insertSystemFeedPost(
  supabase: SupabaseServiceClient,
  input: SystemFeedPostInput,
): Promise<SystemFeedPostResult> {
  const client = supabase as unknown as SystemFeedRpcClient;
  const { data, error } = await client.rpc(SYSTEM_FEED_INSERT_FUNCTION, {
    p_user_id: input.userId,
    p_beach_id: input.beachId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_tag: "conditions",
    p_title: input.title,
    p_description: input.description,
    p_is_active: true,
    p_dedupe_hash: input.dedupeHash,
    p_surf_conditions: input.surfConditions,
    p_expires_at: input.expiresAt,
    p_created_at: input.createdAt,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row) || typeof row.status !== "string") {
    throw new Error("Atomic system-feed insert returned an invalid result");
  }

  if (!isSystemFeedPostStatus(row.status)) {
    throw new Error(`Atomic system-feed insert returned unknown status: ${row.status}`);
  }

  return {
    postId: typeof row.post_id === "string" ? row.post_id : null,
    status: row.status,
  };
}

function isSystemFeedPostStatus(value: string): value is SystemFeedPostStatus {
  return [
    "inserted",
    "duplicate",
    "daily_cap",
    "beach_daily_cap",
    "beach_weekly_cap",
  ].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
