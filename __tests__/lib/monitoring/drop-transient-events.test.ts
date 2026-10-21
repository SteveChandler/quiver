import type { ErrorEvent } from "@sentry/nextjs";
import { dropTransientEvents } from "@/lib/monitoring/drop-transient-events";

const base = (message: string): ErrorEvent => ({ type: undefined, level: "error", message });

describe("dropTransientEvents", () => {
  it("drops PostHog network flush failures", () => {
    expect(dropTransientEvents(base("Error while flushing PostHog: PostHogFetchNetworkError"))).toBeNull();
  });

  it("leaves other errors alone", () => {
    expect(dropTransientEvents(base("Something else failed"))?.level).toBe("error");
  });
});
