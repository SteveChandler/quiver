import type { ErrorEvent } from "@sentry/nextjs";
import { downgradeTransientEvents } from "@/lib/monitoring/downgrade-transient-events";

const base = (message: string): ErrorEvent => ({ type: undefined, level: "error", message });

describe("downgradeTransientEvents", () => {
  it("downgrades PostHog network flush failures to warning", () => {
    const e = downgradeTransientEvents(base("Error while flushing PostHog: PostHogFetchNetworkError"));
    expect(e.level).toBe("warning");
  });

  it("leaves other errors alone", () => {
    expect(downgradeTransientEvents(base("Something else failed")).level).toBe("error");
  });
});
