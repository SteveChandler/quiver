import { PostHog } from "posthog-node";

interface CapturePostHogEventInput {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

let postHogServerClient: PostHog | null = null;

function getPostHogServerClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return null;

  if (!postHogServerClient) {
    postHogServerClient = new PostHog(token, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return postHogServerClient;
}

function getStandardServerProperties(): Record<string, unknown> {
  return {
    app: "quiver-web",
    platform: "server",
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  };
}

export async function capturePostHogEvent({
  distinctId,
  event,
  properties,
}: CapturePostHogEventInput): Promise<void> {
  const client = getPostHogServerClient();
  if (!client) return;

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        ...getStandardServerProperties(),
        ...properties,
      },
    });
    await client.flush();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Server capture failed:", error);
    }
  }
}

export function _resetPostHogServerClientForTesting(): void {
  postHogServerClient = null;
}
