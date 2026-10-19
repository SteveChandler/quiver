import { deterministicEventUuid } from "@/lib/analytics/deterministic-uuid";

describe("deterministicEventUuid", () => {
  it("returns the RFC 4122 v5 uuid for a name", () => {
    expect(deterministicEventUuid("alert_created:rule-1")).toBe(
      "f413417f-7c1d-594d-87e6-8e37ccb66192",
    );
    expect(deterministicEventUuid("alert_created:capture:capture-9")).toBe(
      "760ed442-0b28-5f89-a1f7-5f865b2774a3",
    );
  });

  it("is stable per name and distinct across names", () => {
    expect(deterministicEventUuid("a")).toBe(deterministicEventUuid("a"));
    expect(deterministicEventUuid("a")).not.toBe(deterministicEventUuid("b"));
  });
});
