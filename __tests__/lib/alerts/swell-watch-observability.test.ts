import { createSwellWatchObservability } from "@/lib/alerts/swell-watch/observability";

describe("Swell Watch observability", () => {
  it("retains canonical evaluation IDs, rejects impostors and isolates bounded snapshots", () => {
    const diagnostics = createSwellWatchObservability();
    const evaluationId = "genuine_completed:11111111-1111-4111-8111-111111111111";
    diagnostics.record("detection", { evaluationId });
    for (const invalid of ["genuine_completed:person@example.com", `${evaluationId}:extra`,
      "genuine_completed:11111111-1111-0111-0111-111111111111", "synthetic_fixture:person@example.com"]) {
      diagnostics.record("error", { evaluationId: invalid });
    }
    expect(diagnostics.snapshot().correlations).toEqual([{ evaluationId }]);
    diagnostics.snapshot().correlations[0].evaluationId = "person@example.com";
    expect(diagnostics.snapshot().correlations).toEqual([{ evaluationId }]);
    for (let index = 0; index < 30; index++) diagnostics.record("detection", { evaluationId });
    expect(diagnostics.snapshot().correlations).toHaveLength(20);
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain("person@example.com");
  });

  it("records only bounded aggregate counters and contract IDs", () => {
    const diagnostics = createSwellWatchObservability();
    const evaluationId = "a".repeat(64);
    diagnostics.record("detection", { evaluationId });
    diagnostics.record("suppression", { reasonCode: "ambiguous_persisted_event" });
    diagnostics.record("hold", { regionalEventId: "11111111-1111-8111-8111-111111111111", reasonCode: "static_disabled" });
    diagnostics.record("error", { evaluationId: "person@example.com" as any });
    const result = diagnostics.snapshot();
    expect(result).toMatchObject({ stageCounts: { detection: 1, hold: 1, error: 1 }, reasonCounts: { static_disabled: 1 } });
    expect(result.correlations).toContainEqual({ evaluationId });
    expect(result.reasonCounts.ambiguous_persisted_event).toBe(1);
    expect(JSON.stringify(result)).not.toContain("person@example.com");
  });

  it("rejects arbitrary reasons and invalid counts", () => {
    const diagnostics = createSwellWatchObservability();
    expect(() => diagnostics.record("untrusted-stage" as any)).toThrow("stage");
    expect(() => diagnostics.record("hold", { reasonCode: "user-id-sentinel" as any })).toThrow("reason");
    expect(() => diagnostics.record("error", { count: Number.NaN })).toThrow("count");
    expect(() => diagnostics.record("error", { count: -1 })).toThrow("count");
    expect(() => diagnostics.record("error", { count: Number.MAX_SAFE_INTEGER + 1 })).toThrow("count");
    expect(diagnostics.snapshot().stageCounts.error).toBe(0);
    diagnostics.record("audience", { count: 100_001 });
    expect(diagnostics.snapshot().stageCounts.audience).toBe(100_001);
    diagnostics.record("error", { count: Number.MAX_SAFE_INTEGER });
    expect(() => diagnostics.record("error")).toThrow("count");
    expect(diagnostics.snapshot().stageCounts.error).toBe(Number.MAX_SAFE_INTEGER);
  });
});
