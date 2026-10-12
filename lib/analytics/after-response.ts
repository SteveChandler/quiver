import { after } from "next/server";

/**
 * Runs analytics work after the response is sent, so a slow PostHog or consent
 * call can never delay the request. Outside a Next request scope (scripts,
 * unit tests) `after` throws; fall back to a detached promise. The task must
 * not throw, which holds for every capture helper in lib/analytics.
 */
export function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => undefined);
  }
}
