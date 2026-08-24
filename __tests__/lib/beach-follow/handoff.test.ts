import {
  buildHandoffContext,
  classifyHandoffResolution,
  parseHandoffContext,
  serializeHandoffContext,
} from "@/lib/beach-follow/handoff";
import {
  HandoffRecommendationMode,
  HandoffRecommendationVerdict,
  HandoffSourceSurface,
} from "@/types/exact-handoff";

const NOW = new Date("2026-08-24T12:00:00.000Z");

function validContext() {
  return buildHandoffContext(
    {
      beachId: "beach-123",
      slug: "pleasure-point",
      windowId: "2026-08-25T14:00:00.000Z",
      sourceSurface: HandoffSourceSurface.SurfComparison,
      priorRecommendation: {
        recommendationId: "recommendation-456",
        mode: HandoffRecommendationMode.Best,
        verdict: HandoffRecommendationVerdict.Go,
      },
    },
    { now: NOW, ttlMs: 30 * 60 * 1000 },
  );
}

describe("exact handoff context", () => {
  it("builds, serializes, parses, and resolves a valid exact context", () => {
    const context = validContext();
    const parsed = parseHandoffContext(serializeHandoffContext(context));

    expect(parsed).toEqual({ ok: true, context });
    expect(
      classifyHandoffResolution(context, {
        now: NOW,
        beachExists: true,
        exactWindowExists: true,
      }),
    ).toEqual({ classification: "exact", context });
  });

  it("expires to a truthful beach-only fallback", () => {
    const context = validContext();

    expect(
      classifyHandoffResolution(context, {
        now: new Date("2026-08-24T12:31:00.000Z"),
        beachExists: true,
        exactWindowExists: true,
      }),
    ).toEqual({
      classification: "beach_only",
      context,
      reason: "expired",
    });
  });

  it("rejects malformed contexts without throwing", () => {
    expect(parseHandoffContext("{not-json")).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(
      classifyHandoffResolution("{not-json", {
        now: NOW,
        beachExists: true,
        exactWindowExists: true,
      }),
    ).toEqual({ classification: "invalid", reason: "malformed" });
  });

  it("classifies a removed window as replaced when current truth has a replacement", () => {
    const context = validContext();
    const replacement = {
      beachId: context.beachId,
      slug: context.slug,
      windowId: "2026-08-25T16:00:00.000Z",
      recommendationId: "recommendation-789",
    };

    expect(
      classifyHandoffResolution(context, {
        now: NOW,
        beachExists: true,
        exactWindowExists: false,
        replacement,
      }),
    ).toEqual({
      classification: "replaced",
      context,
      replacement,
      reason: "window_replaced",
    });
  });

  it("falls back to the beach when a removed window has no replacement", () => {
    const context = validContext();

    expect(
      classifyHandoffResolution(context, {
        now: NOW,
        beachExists: true,
        exactWindowExists: false,
      }),
    ).toEqual({
      classification: "beach_only",
      context,
      reason: "window_removed",
    });
  });

  it("tolerates unsupported versions by classifying them as invalid", () => {
    const futureContext = { ...validContext(), v: 2 };

    expect(parseHandoffContext(futureContext)).toEqual({
      ok: false,
      reason: "unsupported_version",
    });
    expect(
      classifyHandoffResolution(futureContext, {
        now: NOW,
        beachExists: true,
        exactWindowExists: true,
      }),
    ).toEqual({
      classification: "invalid",
      reason: "unsupported_version",
    });
  });
});
