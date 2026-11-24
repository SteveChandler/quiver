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

  const withException = (type: string, value: string): ErrorEvent => ({
    type: undefined,
    level: "error",
    exception: { values: [{ type, value }] },
  });

  it("drops a sub-page render that failed on purpose during an outage", () => {
    expect(dropTransientEvents(withException("SubPageDataUnknownError", "[tides] sub-page data unknown"))).toBeNull();
  });

  it("keeps the throttled reader report and any other error type", () => {
    expect(dropTransientEvents(withException("SubPageDataUnavailableError", "tide read failed"))).not.toBeNull();
    expect(dropTransientEvents(withException("TypeError", "SubPageDataUnknownError in a message only"))).not.toBeNull();
  });
});
