import { z } from "zod";

export const webFeedbackContextSchema = z.object({
  user_id: z.uuid(),
  status: z.enum(["unavailable", "available", "reserved", "pending", "extended", "renewing", "review_required", "closed"]),
  terms_version: z.string().nullable(),
  trial_ends_at: z.iso.datetime({ offset: true }).nullable(),
  free_ends_at: z.iso.datetime({ offset: true }).nullable(),
});
export type WebFeedbackContext = z.infer<typeof webFeedbackContextSchema>;
