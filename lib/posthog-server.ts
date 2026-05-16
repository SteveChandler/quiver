import { PostHog } from "posthog-node";

interface CapturePostHogEventInput {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export async function capturePostHogEvent({
  distinctId,
  event,
  properties,
}: CapturePostHogEventInput): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const client = new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  try {
    client.capture({ distinctId, event, properties });
    await client.shutdown();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Server capture failed:", error);
    }
  }
}
