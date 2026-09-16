import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });
const offerProgramSchema = z.enum(["five_sessions_month", "return_three_months"]);
export const offerResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("preview"), months: z.union([z.literal(1), z.literal(3)]), terms_version: z.string().min(1), state: z.enum(["enrolled", "held", "reserved", "handoff_started", "unknown", "verified"]), completed_sessions: z.number().int().nonnegative() }),
  z.object({ status: z.literal("verified"), expires_at: timestamp, mirror_verified: z.boolean() }),
  z.object({ status: z.literal("not_earned"), completed_sessions: z.number().int().min(0).max(4) }),
  z.object({ status: z.enum(["disabled", "not_found", "busy", "paused", "held_active_access", "reconciliation_required"]) }),
]);
export type OfferResult = z.infer<typeof offerResultSchema>;
export const ownedOffersSchema = z.object({
  contract_version: z.literal(1), user_id: z.uuid(), enrollment: z.object({ terms_version: z.string().min(1) }).nullable(),
  offers: z.array(z.object({ award_id: z.uuid(), program_id: offerProgramSchema, months: z.union([z.literal(1), z.literal(3)]), terms_version: z.string().min(1),
    state: z.enum(["enrolled", "held", "reserved", "handoff_started", "unknown", "verified"]),
    earned: z.boolean(), claim_requested: z.boolean(), completed_sessions: z.number().int().nonnegative(), expires_at: timestamp.nullable(), mirror_verified: z.boolean(),
  }).refine(offer => offer.state !== "verified" || (offer.earned && offer.expires_at !== null), "Verified offers require an earned receipt")).max(2),
});
export function offerHttpStatus(result: OfferResult): number {
  if (result.status === "verified" || result.status === "preview") return 200;
  if (result.status === "not_found") return 404;
  if (result.status === "disabled" || result.status === "reconciliation_required") return 503;
  return 409;
}
