import { z } from "zod";

export const FEEDBACK_REASONS = {
  forecast: "The forecast didn’t feel right",
  value: "I couldn’t see the value yet",
  time: "I didn’t get enough time to try it",
  feature: "I was looking for a feature",
  price: "The price wasn’t right for me",
  technical: "I ran into an app problem",
  other: "Another reason",
} as const;

export const feedbackSubmissionSchema = z.object({
  request_id: z.uuid(),
  reason: z.enum(["forecast", "value", "time", "feature", "price", "technical", "other"]),
  note: z.string().trim().max(2000).default(""),
  message_instance_id: z.uuid().optional(),
}).strict().refine(value => value.reason !== "other" || value.note.length > 0, { message: "Please tell us a little more.", path: ["note"] });

export const feedbackContextSchema = z.object({
  contract_version: z.literal(1), user_id: z.uuid(),
  status: z.enum(["disabled", "unavailable", "available", "submitted", "verified"]),
  submission_id: z.uuid().nullable(),
  reservation_id: z.uuid().nullable(),
  redemption_state: z.enum(["submitted", "reserved", "verified"]).nullable(),
  verified_until: z.iso.datetime({ offset: true }).nullable(),
  offer: z.object({
    store: z.enum(["APP_STORE", "PLAY_STORE", "STRIPE", "RC_BILLING"]), months: z.literal(1),
    product_id: z.string().min(1), offer_identifier: z.string().min(1), terms_version: z.string().min(1),
    trial_ends_at: z.iso.datetime({ offset: true }), free_ends_at: z.iso.datetime({ offset: true }),
  }).nullable(),
}).refine(value => value.offer === null || value.submission_id !== null, "Offer requires saved feedback").refine(value => value.status !== "verified" || (value.verified_until !== null && value.redemption_state === "verified" && value.submission_id !== null), "Verified offer requires a receipt").refine(value => !value.offer || Date.parse(value.offer.free_ends_at) > Date.parse(value.offer.trial_ends_at), "Invalid offer dates");
export type FeedbackContext = z.infer<typeof feedbackContextSchema>;

export const FEEDBACK_OFFER_COPY = "If you’re up for a little more time in the water with Quiver, your next month of Pro is on us.";
