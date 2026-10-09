// __tests__/lib/alerts/swell-outlook/first-sighting.test.ts
import {
  buildFirstSightingPayload,
  renderFirstSightingTitle,
  FIRST_SIGHTING_BODY_MAX_CHARS,
  firstSightingFaceHeightFt,
  renderFirstSightingBody,
  selectFirstSightingCandidates,
} from "@/lib/alerts/swell-outlook/first-sighting";
import { OUTLOOK_HOME_BEACH_ID as HOME, outlookSwell } from "@/__tests__/helpers/outlook-swell";

const OTHER = "ffffffff-0000-4000-8000-000000000002";

describe("selectFirstSightingCandidates", () => {
  it("keeps only forecast swells that are in range, same size earliest peak first", () => {
    const swells = [
      outlookSwell({ id: "late", peakAt: "2026-09-24T15:00:00.000Z" }),
      outlookSwell({ id: "early", peakAt: "2026-09-21T15:00:00.000Z" }),
      outlookSwell({ id: "shrinking", status: "shrinking" }),
      outlookSwell({ id: "faded", status: "faded" }),
      outlookSwell({ id: "arrived", status: "arrived" }),
      outlookSwell({ id: "rideable", fit: { status: "rideable", boards: [] } }),
      outlookSwell({ id: "small", fit: { status: "below_range", boards: [] } }),
      outlookSwell({ id: "big", fit: { status: "above_range", boards: [] } }),
      outlookSwell({ id: "unknown", fit: { status: "unknown", boards: [] } }),
      outlookSwell({ id: "noperiod", periodS: null }),
    ];
    expect(selectFirstSightingCandidates({ swells, homeBeachId: HOME, tier: "premium" }).map((swell) => swell.id)).toEqual(["early", "late"]);
  });

  it("picks the biggest swell first, and the closest beach when sizes tie", () => {
    const near = { id: "ffffffff-0000-4000-8000-000000000003", name: "Near" };
    const far = { id: "ffffffff-0000-4000-8000-000000000004", name: "Far" };
    const swells = [
      outlookSwell({ id: "small-early", faceHeightFt: { min: 1, max: 2 }, peakAt: "2026-09-20T15:00:00.000Z" }),
      outlookSwell({ id: "big-far", faceHeightFt: { min: 4, max: 5.5 }, beach: far, peakAt: "2026-09-25T15:00:00.000Z" }),
      outlookSwell({ id: "big-near", faceHeightFt: { min: 4, max: 5.5 }, beach: near, peakAt: "2026-09-26T15:00:00.000Z" }),
    ];
    const distanceKmByBeach = new Map([[near.id, 12], [far.id, 140]]);
    expect(selectFirstSightingCandidates({ swells, homeBeachId: HOME, tier: "premium", distanceKmByBeach }).map((swell) => swell.id))
      .toEqual(["big-near", "big-far", "small-early"]);
  });

  it("limits free users to swells sized at the home beach", () => {
    const swells = [outlookSwell({ id: "home" }), outlookSwell({ id: "other", beach: { id: OTHER, name: "Elsewhere" } })];
    expect(selectFirstSightingCandidates({ swells, homeBeachId: HOME, tier: "free" }).map((swell) => swell.id)).toEqual(["home"]);
    expect(selectFirstSightingCandidates({ swells, homeBeachId: null, tier: "free" })).toEqual([]);
  });
});

describe("buildFirstSightingPayload", () => {
  const payload = buildFirstSightingPayload({ swell: outlookSwell({ fit: { status: "in_range", boards: ["longboard"] } }), timezone: "America/Los_Angeles" });

  it("opens the swell detail by the swell's own key", () => {
    expect(payload).toMatchObject({ event_key: `${HOME}:NW:2026-09-21:p`, kind: "coming", beach_id: HOME, peak_date: "2026-09-21" });
    expect(payload.share_url).toContain(encodeURIComponent(`${HOME}:NW:2026-09-21:p`));
  });

  it("states size, period, direction and day, and makes no rarity claim", () => {
    expect(payload.body).toBe(
      "WNW swell from the North Pacific, 14s. Peaks Monday morning. Sets up to 4.5 ft at Blacks Beach. "
      + "Good size for your longboard. Showing at 3 nearby breaks.",
    );
    expect(`${payload.title} ${payload.body}`).not.toMatch(/biggest|first swell|flat|in weeks|rare|the call/i);
  });

  it("titles the push with direction, days in the water and set size, never a title-pool line", () => {
    expect(payload.title).toBe("WNW swell Mon, sets to 4.5 ft");
    const spanning = outlookSwell({
      directionLabel: "SSW", arrivalAt: "2026-10-06T16:00:00.000Z", peakAt: "2026-10-08T22:00:00.000Z",
      fadeAt: "2026-10-09T23:00:00.000Z", faceHeightFt: { min: 3, max: 4 },
    });
    expect(renderFirstSightingTitle(spanning, "America/Los_Angeles")).toBe("SSW swell Tue-Fri, sets to 4 ft");
    expect(renderFirstSightingTitle({ ...spanning, fadeAt: undefined }, "America/Los_Angeles")).toBe("SSW swell Tue-Thu, sets to 4 ft");
    expect(renderFirstSightingTitle({ ...spanning, fadeAt: "2026-10-07T12:00:00.000Z" }, "America/Los_Angeles")).toBe("SSW swell Tue-Thu, sets to 4 ft");
  });

  it("never names a board when several fit or none do", () => {
    const several = buildFirstSightingPayload({ swell: outlookSwell({ fit: { status: "in_range", boards: ["fish", "longboard"] } }), timezone: "America/Los_Angeles" });
    expect(several.body).not.toMatch(/your/);
    const none = buildFirstSightingPayload({ swell: outlookSwell(), timezone: "America/Los_Angeles" });
    expect(none.body).not.toMatch(/your/);
  });

  it("marks 8 ft and up as major", () => {
    const big = buildFirstSightingPayload({ swell: outlookSwell({ faceHeightFt: { min: 7.5, max: 9.5 } }), timezone: "America/Los_Angeles" });
    expect(big.awareness_severity).toBe("major");
    expect(firstSightingFaceHeightFt(outlookSwell({ faceHeightFt: { min: 3.5, max: 4.5 } }))).toBe(4);
  });
});

it("uses neutral copy across keys and sizes without any rarity field", () => {
  for (const size of [4, 8, 12]) {
    for (let key = 0; key < 30; key += 1) {
      const payload = buildFirstSightingPayload({ swell: outlookSwell({ eventKey: `swell-${key}`,
        faceHeightFt: { min: size - 0.5, max: size + 0.5 } }), timezone: "America/Los_Angeles" });
      expect(`${payload.title} ${payload.body}`).not.toMatch(/biggest|first swell|flat|in weeks|rare|the call|machine.learning|\bAI\b/i);
      expect(payload).not.toHaveProperty("rarity");
    }
  }
});

describe("renderFirstSightingBody", () => {
  const timezone = "America/Los_Angeles";

  it("reads like a swell report: source, timing across days, size by spot direction, hazard", () => {
    const swell = outlookSwell({
      directionLabel: "SSW", source: "southern_hemisphere", periodS: 15, beachCount: 7,
      arrivalAt: "2026-10-08T16:00:00.000Z", peakAt: "2026-10-10T01:00:00.000Z",
      faceHeightFt: { min: 3, max: 4 }, beach: { id: HOME, name: "Blacks Beach" },
      sizeByOrientation: { westFacing: { min: 2.5, max: 4.5 }, southFacing: { min: 1.5, max: 2.5 } },
    });
    expect(renderFirstSightingBody({ swell, timezone, hazard: "high_rip_current" })).toBe(
      "SSW swell from the southern hemisphere, 15s. Builds from Thursday, peaks Friday evening. Sets up to 4 ft at Blacks Beach. "
      + "West-facing spots up to 4.5 ft, south-facing up to 2.5 ft. Showing at 7 nearby breaks. "
      + "NWS beach hazards statement out for rip currents.",
    );
  });

  it("names a tropical storm when there is one", () => {
    const swell = outlookSwell({ source: "tropical", stormName: "Priscilla" });
    expect(renderFirstSightingBody({ swell, timezone, hazard: null })).toMatch(/^WNW swell from tropical storm Priscilla, 14s\./);
  });

  it("drops the least useful sentences first and never the core facts", () => {
    const swell = outlookSwell({
      beach: { id: HOME, name: "A".repeat(150) }, beachCount: 9, fit: { status: "in_range", boards: ["longboard"] },
      sizeByOrientation: { westFacing: { min: 2.5, max: 4.5 }, southFacing: { min: 1.5, max: 2.5 } },
    });
    const body = renderFirstSightingBody({ swell, timezone, hazard: "high_surf" });
    expect(body.length).toBeLessThanOrEqual(FIRST_SIGHTING_BODY_MAX_CHARS);
    expect(body).toContain("NWS high surf advisory in effect.");
    expect(body).not.toContain("nearby breaks");
    expect(body).toContain(`Sets up to 4.5 ft at ${"A".repeat(150)}.`);
  });
});

describe('tide-aware first-sighting copy and payload', () => {
  const surfWindow = {
    state: 'recommended' as const,
    window: { start: '2026-10-08T17:00:00.000Z', end: '2026-10-08T19:00:00.000Z', localDate: '2026-10-08',
      timezone: 'America/Los_Angeles', faceHeightFt: { min: 3, max: 4 } },
    reasons: ['high_tide_outside_preference', 'better_tide_after_peak'],
  };

  it('adds a beach-local window and fixed tide sentence while preserving existing fields', () => {
    const args = { swell: outlookSwell(), timezone: 'Pacific/Honolulu' };
    const baseline = buildFirstSightingPayload(args);
    const payload = buildFirstSightingPayload({ ...args, surfWindow });
    expect(payload.body).toContain('Best window Thu 10 AM–12 PM.');
    expect(payload.body).toContain('Swell peaks at high tide; go as it drops.');
    expect(payload.body.length).toBeLessThanOrEqual(300);
    expect(payload.surf_window).toEqual({ state: 'recommended', start: surfWindow.window.start, end: surfWindow.window.end,
      local_date: '2026-10-08', timezone: 'America/Los_Angeles', reasons: surfWindow.reasons });
    const { body: _body, surf_window: _window, ...existing } = payload;
    const { body: _baselineBody, ...baselineFields } = baseline;
    expect(existing).toEqual(baselineFields);
  });

  it.each(['no_suitable_window', 'insufficient_tide_evidence'] as const)('keeps the body unchanged for %s', (state) => {
    const args = { swell: outlookSwell(), timezone: 'America/Los_Angeles' };
    const baseline = buildFirstSightingPayload(args);
    const payload = buildFirstSightingPayload({ ...args, surfWindow: { state, window: null, reasons: ['tide_data_unavailable'] } });
    expect(payload.body).toBe(baseline.body);
    expect(payload.surf_window).toMatchObject({ state, start: null, end: null, local_date: null, timezone: null });
  });

  it('drops lower-priority copy to retain the window within the body budget', () => {
    const payload = buildFirstSightingPayload({ swell: outlookSwell({ source: 'southern_hemisphere',
      fit: { status: 'in_range', boards: ['longboard'] },
      sizeByOrientation: { westFacing: { min: 4, max: 6 }, southFacing: { min: 3, max: 5 } } }),
      timezone: 'America/Los_Angeles', hazard: 'high_rip_current', surfWindow });
    expect(payload.body).toContain('Best window Thu 10 AM–12 PM.');
    expect(payload.body.length).toBeLessThanOrEqual(FIRST_SIGHTING_BODY_MAX_CHARS);
  });
});


it('retains the window within 300 characters with a long beach name', () => {
  const payload = buildFirstSightingPayload({ swell: outlookSwell({ source: 'southern_hemisphere',
    beach: { id: HOME, name: 'A'.repeat(180) }, arrivalAt: '2026-10-06T16:00:00.000Z', peakAt: '2026-10-08T22:00:00.000Z' }), timezone: 'America/Los_Angeles', hazard: 'high_surf',
    surfWindow: { state: 'recommended', window: { start: '2026-10-08T17:00:00.000Z', end: '2026-10-08T19:00:00.000Z',
      localDate: '2026-10-08', timezone: 'America/Los_Angeles', faceHeightFt: { min: 3, max: 4 } }, reasons: [] } });
  expect(payload.body).toContain('Best window Thu 10 AM–12 PM.');
  expect(payload.body.length).toBeLessThanOrEqual(300);
});
