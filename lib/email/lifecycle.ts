import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const LIFECYCLE_CAMPAIGN = "startup-lifecycle-v1";
export const LIFECYCLE_VERSION = 1;
export const lifecycleJobSchema = z.enum(["welcome", "activation", "progress", "friction", "trial_support", "routine", "offer_ready"]);
export type LifecycleJob = z.infer<typeof lifecycleJobSchema>;
export const lifecycleDecisionSchema = z.object({
  user_id: z.uuid(), campaign_id: z.string().nullable(),
  status: z.enum(["due", "deferred", "held", "quiet", "expired"]), reason: z.string(),
  job: lifecycleJobSchema.optional(), episode: z.string().optional(),
  campaign_version: z.number().optional(), content_hash: z.string().optional(),
  due_at: z.string().optional(), next_eligible_at: z.string().optional(), expires_at: z.string().optional(),
  source: z.object({
    email: z.email(), name: z.string().nullable(), home_beach_id: z.uuid().nullable(),
    offer_id: z.uuid().nullable().optional(), offer_months: z.union([z.literal(1), z.literal(3)]).nullable().optional(),
    sessions: z.number().int().nonnegative(), last_completion: z.string().nullable(), trial_end: z.string().nullable(),
  }).optional(),
});
export type LifecycleDecision = z.infer<typeof lifecycleDecisionSchema>;

// Narrow boundary until types can be generated from the locally applied migration.
export async function lifecycleRpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const db = await createSupabaseServiceRoleClient();
  const { data, error } = await (db as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  }).rpc(name, args);
  if (error) throw new Error(`Lifecycle storage failed: ${name}`);
  return data;
}

export function lifecycleEnabled(): boolean {
  return process.env.EMAIL_LIFECYCLE_ENABLED === "true";
}
