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
const SERIALIZED_V1_CONTEXT = JSON.stringify({
  v: 1,
  beachId: "11111111-1111-4111-8111-111111111111",
  slug: "pleasure-point",
  windowId: "2026-08-25T14:00:00.000Z",
  sourceSurface: "surf_comparison",
  generatedAt: "2026-08-24T12:00:00.000Z",
  expiresAt: "2026-08-24T12:30:00.000Z",
  priorRecommendation: {
    recommendationId: "recommendation-456",
    mode: "my-spots",
    verdict: "go",
  },
});

function validContext() {
  return buildHandoffContext(
    {
      beachId: "11111111-1111-4111-8111-111111111111",
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

  it("accepts the canonical serialized v1 fixture with my-spots mode", () => {
    const parsed = parseHandoffContext(SERIALIZED_V1_CONTEXT);

    expect(parsed).toMatchObject({
      ok: true,
      context: { priorRecommendation: { mode: "my-spots" } },
    });
  });

  it("expires to a truthful beach-only fallback", () => {
    const parsed = parseHandoffContext(SERIALIZED_V1_CONTEXT);
    if (!parsed.ok) throw new Error("Expected valid fixture");
    const { context } = parsed;

    expect(
      classifyHandoffResolution(SERIALIZED_V1_CONTEXT, {
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
    const parsed = parseHandoffContext(SERIALIZED_V1_CONTEXT);
    if (!parsed.ok) throw new Error("Expected valid fixture");
    const { context } = parsed;
    const replacement = {
      beachId: context.beachId,
      slug: context.slug,
      windowId: "2026-08-25T16:00:00.000Z",
      recommendationId: "recommendation-789",
    };

    expect(
      classifyHandoffResolution(SERIALIZED_V1_CONTEXT, {
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
    const parsed = parseHandoffContext(SERIALIZED_V1_CONTEXT);
    if (!parsed.ok) throw new Error("Expected valid fixture");
    const { context } = parsed;

    expect(
      classifyHandoffResolution(SERIALIZED_V1_CONTEXT, {
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

  it("classifies the identical missing-beach fixture as invalid", () => {
    expect(
      classifyHandoffResolution(SERIALIZED_V1_CONTEXT, {
        now: NOW,
        beachExists: false,
        exactWindowExists: false,
      }),
    ).toEqual({ classification: "invalid", reason: "beach_removed" });
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
