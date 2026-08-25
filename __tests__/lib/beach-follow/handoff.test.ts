import {
  HANDOFF_FUTURE_SKEW_MS,
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
const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const WINDOW_ID = "2026-08-25T14:00:00.000Z";
const RECOMMENDATION_ID = `beach:${BEACH_ID}:${WINDOW_ID}`;
const OTHER_BEACH_ID = "22222222-2222-4222-8222-222222222222";
const SERIALIZED_V1_CONTEXT = JSON.stringify({
  v: 1,
  beachId: BEACH_ID,
  slug: "pleasure-point",
  windowId: WINDOW_ID,
  sourceSurface: "surf_comparison",
  generatedAt: "2026-08-24T12:00:00.000Z",
  expiresAt: "2026-08-24T12:30:00.000Z",
  priorRecommendation: {
    recommendationId: RECOMMENDATION_ID,
    mode: "my-spots",
    verdict: "go",
  },
});
const CROSS_BEACH_PRIOR_RECOMMENDATION_CONTEXT = JSON.stringify({
  v: 1,
  beachId: BEACH_ID,
  slug: "pleasure-point",
  windowId: WINDOW_ID,
  sourceSurface: "surf_comparison",
  generatedAt: "2026-08-24T12:00:00.000Z",
  expiresAt: "2026-08-24T12:30:00.000Z",
  priorRecommendation: {
    recommendationId: `beach:${OTHER_BEACH_ID}:${WINDOW_ID}`,
    mode: "my-spots",
    verdict: "go",
  },
});
const IMPOSSIBLE_DATE_CONTEXT = JSON.stringify({
  v: 1,
  beachId: BEACH_ID,
  slug: "pleasure-point",
  windowId:
    "11111111-1111-4111-8111-111111111111-2026-02-30T00-00-00-000Z",
  sourceSurface: "surf_comparison",
  generatedAt: "2026-08-24T12:00:00.000Z",
  expiresAt: "2026-08-24T12:30:00.000Z",
  priorRecommendation: {
    recommendationId:
      "beach:11111111-1111-4111-8111-111111111111:2026-02-30T00:00:00Z",
    mode: "my-spots",
    verdict: "go",
  },
});

const INVALID_ID_CONTEXTS = [
  { field: "email-like beachId", value: { beachId: "surfer@example.com" } },
  { field: "token-like windowId", value: { windowId: "Bearer secret-token" } },
  {
    field: "over-length recommendationId",
    value: {
      priorRecommendation: {
        recommendationId: "a".repeat(201),
        mode: "my-spots",
        verdict: "go",
      },
    },
  },
] as const;

function validContext() {
  return buildHandoffContext(
    {
      beachId: BEACH_ID,
      slug: "pleasure-point",
      windowId: WINDOW_ID,
      sourceSurface: HandoffSourceSurface.SurfComparison,
      priorRecommendation: {
        recommendationId: RECOMMENDATION_ID,
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

  it("rejects the identical cross-beach prior recommendation fixture", () => {
    expect(parseHandoffContext(CROSS_BEACH_PRIOR_RECOMMENDATION_CONTEXT)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(classifyHandoffResolution(CROSS_BEACH_PRIOR_RECOMMENDATION_CONTEXT, {
      now: NOW,
      beachExists: true,
      exactWindowExists: true,
    })).toEqual({ classification: "invalid", reason: "malformed" });
  });

  it("rejects the identical impossible-date fixture as malformed", () => {
    const impossibleContext = JSON.parse(IMPOSSIBLE_DATE_CONTEXT) as Record<
      string,
      unknown
    >;

    expect(parseHandoffContext({
      ...impossibleContext,
      windowId: WINDOW_ID,
    })).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(parseHandoffContext({
      ...impossibleContext,
      priorRecommendation: {
        recommendationId: RECOMMENDATION_ID,
        mode: "my-spots",
        verdict: "go",
      },
    })).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(classifyHandoffResolution(IMPOSSIBLE_DATE_CONTEXT, {
      now: NOW,
      beachExists: true,
      exactWindowExists: false,
    })).toEqual({ classification: "invalid", reason: "malformed" });
  });

  it.each(INVALID_ID_CONTEXTS)("rejects $field", ({ value }) => {
    const context = JSON.parse(SERIALIZED_V1_CONTEXT) as Record<string, unknown>;
    const malformed = {
      ...context,
      ...value,
    };

    expect(parseHandoffContext(malformed)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a context generated beyond the named clock-skew allowance", () => {
    expect(HANDOFF_FUTURE_SKEW_MS).toBe(5 * 60 * 1000);
    const futureContext = {
      ...(JSON.parse(SERIALIZED_V1_CONTEXT) as Record<string, unknown>),
      generatedAt: "2026-08-24T12:05:00.001Z",
      expiresAt: "2026-08-24T12:35:00.001Z",
    };

    expect(
      classifyHandoffResolution(futureContext, {
        now: NOW,
        beachExists: true,
        exactWindowExists: true,
      })
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
      recommendationId: `beach:${BEACH_ID}:2026-08-25T16:00:00.000Z`,
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

  it("classifies the identical cross-beach replacement fixture as beach-only", () => {
    const parsed = parseHandoffContext(SERIALIZED_V1_CONTEXT);
    if (!parsed.ok) throw new Error("Expected valid fixture");
    const { context } = parsed;

    expect(
      classifyHandoffResolution(SERIALIZED_V1_CONTEXT, {
        now: NOW,
        beachExists: true,
        exactWindowExists: false,
        replacement: {
          beachId: OTHER_BEACH_ID,
          slug: "steamer-lane",
          windowId: "2026-08-25T16:00:00.000Z",
          recommendationId:
            `beach:${OTHER_BEACH_ID}:2026-08-25T16:00:00.000Z`,
        },
      }),
    ).toEqual({
      classification: "beach_only",
      context,
      reason: "window_removed",
    });
  });

  it("rejects a structured replacement recommendation owned by another beach", () => {
    const parsed = parseHandoffContext(SERIALIZED_V1_CONTEXT);
    if (!parsed.ok) throw new Error("Expected valid fixture");
    const { context } = parsed;

    expect(
      classifyHandoffResolution(SERIALIZED_V1_CONTEXT, {
        now: NOW,
        beachExists: true,
        exactWindowExists: false,
        replacement: {
          beachId: BEACH_ID,
          slug: "pleasure-point",
          windowId: "2026-08-25T16:00:00.000Z",
          recommendationId:
            `beach:${OTHER_BEACH_ID}:2026-08-25T16:00:00.000Z`,
        },
      }),
    ).toEqual({
      classification: "beach_only",
      context,
      reason: "window_removed",
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
