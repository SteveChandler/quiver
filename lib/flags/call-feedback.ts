export const CALL_FEEDBACK_ENABLED_FLAG = "CALL_FEEDBACK_ENABLED";

export function isCallFeedbackEnabled(): boolean {
  return process.env[CALL_FEEDBACK_ENABLED_FLAG] === "true";
}
