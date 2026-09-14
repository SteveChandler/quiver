import { lifecycleRpc } from "@/lib/email/lifecycle";
import { feedbackContextSchema, type FeedbackContext } from "./contract";

export function parseFeedbackContext(value: unknown, userId: string): FeedbackContext {
  const result = feedbackContextSchema.parse(value);
  if (result.user_id !== userId) throw new Error("Feedback account mismatch");
  if (process.env.TRIAL_FEEDBACK_REDEMPTION_ENABLED !== "true" || process.env.TRIAL_FEEDBACK_WORKER_ENABLED !== "true" || !["APP_STORE", "PLAY_STORE"].includes(result.offer?.store ?? "")) result.offer = null;
  return result;
}
export async function readFeedbackContext(userId: string): Promise<FeedbackContext> {
  return parseFeedbackContext(await lifecycleRpc("trial_feedback_context", { p_user_id: userId }), userId);
}
