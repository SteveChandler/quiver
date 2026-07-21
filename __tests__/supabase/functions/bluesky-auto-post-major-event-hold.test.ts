/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  authorizationContextKey,
  evaluateHoldAuthorizationRows,
  type HoldAuthorizationContext,
  shouldUseObjectiveSafetyPost,
} from "../../../supabase/functions/bluesky-auto-post/hold-policy";

const source = readFileSync(
  join(
    process.cwd(),
    "supabase/functions/bluesky-auto-post/index.ts",
  ),
  "utf8",
);

function functionBody(name: string, nextName: string): string {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start + 1);
  if (start < 0 || end < 0) throw new Error(`Missing ${name} source block`);
  return source.slice(start, end);
}

describe("Bluesky major-event hold boundary", () => {
  it("resolves the regional hold RPC and filters all three complete post pools", () => {
    expect(source).toContain("resolve_active_regional_recommendation_holds");
    expect(
      functionBody("generateGoNoPost", "generateWeekendWavePost"),
    ).toContain("filterScoredBeachesForMajorEventHold");
    expect(
      functionBody("generateWeekendWavePost", "generateLongboardSundayPost"),
    ).toContain("filterScoredBeachesForMajorEventHold");
    expect(
      functionBody("generateLongboardSundayPost", "writePostingLog"),
    ).toContain("filterScoredBeachesForMajorEventHold");
  });

  it("has an objective fail-closed post with no beach, window, image, or confidence copy", () => {
    expect(source).toMatch(/San Diego swell and safety awareness/);
    expect(source).toMatch(
      /Wave, wind, and tide conditions can change quickly/,
    );
    expect(source).toMatch(
      /beachesFeatured:\s*\[\][\s\S]*imageUrl:\s*null/,
    );
    expect(source).not.toMatch(/low confidence/i);
  });

  it("binds weekend OG images only with exact server beach and time identifiers", () => {
    const weekend = functionBody(
      "generateWeekendWavePost",
      "generateLongboardSundayPost",
    );
    expect(weekend).toContain("sat_beach_id");
    expect(weekend).toContain("sat_starts_at");
    expect(weekend).toContain("sat_ends_at");
    expect(weekend).toContain("sun_beach_id");
    expect(weekend).not.toContain("sat_summary=");
    expect(weekend).not.toContain("sat_beach=");
  });

  it("carries exact internal contexts and re-resolves them immediately before posting", () => {
    const handler = source.slice(source.indexOf("Deno.serve"));
    const imageUpload = handler.indexOf("uploadImageBlob(");
    const externalPost = handler.indexOf("createBlueskyPost(");
    const preUploadResolution = handler.indexOf(
      "applyLastMileMajorEventHoldPolicy(",
    );
    const lastMileResolution = handler.lastIndexOf(
      "applyLastMileMajorEventHoldPolicy(",
      externalPost,
    );

    expect(source).toContain(
      "authorizationContexts: HoldAuthorizationContext[]",
    );
    expect(preUploadResolution).toBeLessThan(imageUpload);
    expect(imageUpload).toBeGreaterThan(-1);
    expect(lastMileResolution).toBeGreaterThan(imageUpload);
    expect(externalPost).toBeGreaterThan(lastMileResolution);
  });

  it("keeps dev notes outside the forecast hold path", () => {
    const handler = source.slice(source.indexOf("Deno.serve"));
    expect(handler.indexOf("handleDevNotesPost(")).toBeLessThan(
      handler.indexOf("applyLastMileMajorEventHoldPolicy("),
    );
  });

  it("re-resolves before a disabled forecast post is logged or returned", () => {
    const handler = source.slice(source.indexOf("Deno.serve"));
    const generatedLog = handler.indexOf(
      "[bluesky-auto-post] Generated text",
    );
    const dryRunBranch = handler.indexOf("if (!config.enabled)");
    const dryRunResolution = handler.lastIndexOf(
      "applyLastMileMajorEventHoldPolicy(",
      dryRunBranch,
    );

    expect(dryRunResolution).toBeGreaterThan(-1);
    expect(dryRunResolution).toBeLessThan(generatedLog);
    expect(generatedLog).toBeLessThan(dryRunBranch);
  });
});

describe("Bluesky hold authorization evaluation", () => {
  const context: HoldAuthorizationContext = {
    beachId: "11111111-1111-4111-8111-111111111111",
    startsAt: "2026-07-20T14:00:00.000Z",
    endsAt: "2026-07-20T18:00:00.000Z",
  };
  const activeRow = {
    record_id: "22222222-2222-4222-8222-222222222222",
    hold_id: "33333333-3333-4333-8333-333333333333",
    version: 1,
    status: "active",
    action: "suppress_positive",
    scope_beach_ids: [context.beachId],
    scope_exposure_classes: [],
    affected_cohorts: ["beginner", "intermediate", "unknown"],
    valid_from: "2026-07-20T12:00:00.000Z",
    valid_until: "2026-07-21T12:00:00.000Z",
    effective_at: "2026-07-20T13:00:00.000Z",
    expires_at: "2026-07-21T12:00:00.000Z",
  };

  it("blocks the exact unknown-audience beach and time context", () => {
    const resolution = evaluateHoldAuthorizationRows({
      contexts: [context],
      rows: [activeRow],
      asOf: "2026-07-20T13:30:00.000Z",
    });

    expect(resolution).toEqual({
      state: "resolved",
      blockedContextKeys: new Set([authorizationContextKey(context)]),
    });
    expect(shouldUseObjectiveSafetyPost("enforce", resolution)).toBe(true);
  });

  it("fails closed when a resolver row cannot be trusted", () => {
    const resolution = evaluateHoldAuthorizationRows({
      contexts: [context],
      rows: [{ ...activeRow, valid_until: "not-an-instant" }],
      asOf: "2026-07-20T13:30:00.000Z",
    });

    expect(resolution).toEqual({
      state: "unavailable",
      blockedContextKeys: new Set(),
    });
    expect(shouldUseObjectiveSafetyPost("enforce", resolution)).toBe(true);
  });

  it("preserves off and shadow behavior even when resolution is unavailable", () => {
    const unavailable = {
      state: "unavailable" as const,
      blockedContextKeys: new Set<string>(),
    };

    expect(shouldUseObjectiveSafetyPost("off", unavailable)).toBe(false);
    expect(shouldUseObjectiveSafetyPost("shadow", unavailable)).toBe(false);
    expect(shouldUseObjectiveSafetyPost("unexpected", unavailable)).toBe(true);
  });
});
