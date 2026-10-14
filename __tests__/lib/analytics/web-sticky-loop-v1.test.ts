import { createHash } from "node:crypto";
import type { ProfileExclusionReason } from "@/lib/analytics/report-guards";
import {
  buildWebStickyLoopReport,
  type WebEventFamily,
  type WebStickyEventRow,
} from "@/lib/analytics/web-sticky-loop-v1";

const window = {
  startDate: "2026-10-01", endDate: "2026-11-15",
  start: "2026-10-01T07:00:00.000Z", end: "2026-11-15T08:00:00.000Z",
  timeZone: "America/Los_Angeles",
};

function row(personId: string, timestamp: string, family: WebEventFamily, options: Partial<WebStickyEventRow> = {}): WebStickyEventRow {
  const event = family === "nearby" ? "nearby_beaches_viewed" : family === "app_handoff" ? "app_handoff_view" : family === "signup_cta" ? "signup_cta_view" : "page_view";
  return {
    personId, distinctId: `cookie-${personId}`, timestamp, family, event,
    sessionId: "session-1", localDate: timestamp.slice(0, 10),
    identified: false, surface: family === "home" ? "landing-page" : family,
    uuid: `${personId}-${timestamp}-${family}`,
    ...options,
  };
}

function build(rows: WebStickyEventRow[], powerDays = 4, profileExclusions = new Map<string, ProfileExclusionReason | null>()) {
  return buildWebStickyLoopReport({ rows, window, asOf: "2026-11-15T12:00:00.000Z", powerDays, profileExclusions });
}

describe("web sticky loop v1", () => {
  it.each<ProfileExclusionReason>(["mock_profile", "not_real_user", "deleted_profile", "system_account", "internal_account"])("excludes every row for a person with profile reason %s before power-user segmentation", (reason) => {
    const distinctId = "11111111-1111-4111-8111-111111111111";
    const realId = "44444444-4444-4444-8444-444444444444";
    const missingId = "55555555-5555-4555-8555-555555555555";
    const rows = [
      row("excluded-person", "2026-10-01T10:00:00Z", "landing"),
      row("excluded-person", "2026-10-01T11:00:00Z", "home", { distinctId: realId, identified: true }),
      row("excluded-person", "2026-10-01T11:30:00Z", "home", { distinctId: missingId, identified: true }),
      ...[1, 2, 3, 4].map((day) => row("excluded-person", `2026-10-0${day}T12:00:00Z`, "home", { distinctId, identified: true })),
      row("anonymous-person", "2026-10-01T12:00:00Z", "map"),
    ];
    const report = build(rows, 4, new Map<string, ProfileExclusionReason | null>([[distinctId, reason], [realId, null], [missingId, "missing_profile"]]));
    expect(report.excluded.profile).toEqual({ persons: 1, byReason: { [reason]: 1 } });
    expect(report.segments.identified.people).toBe(0);
    expect(report.segments.anonymous.people).toBe(1);
    expect(report.segments.anonymous.families.landing.views).toBe(0);
    expect(report.powerUsers).toHaveLength(0);
    expect(report.identifiedWithoutProfile).toBe(0);
  });

  it("keeps and counts persons with missing profiles, including power users", () => {
    const missingId = "22222222-2222-4222-8222-222222222222";
    const rows = [
      row("missing-person", "2026-10-01T12:00:00Z", "home", { distinctId: missingId, identified: true }),
      ...[1, 2, 3, 4].map((day) => row("missing-power", `2026-10-0${day}T12:00:00Z`, "home", { distinctId: missingId, identified: true })),
    ];
    const report = build(rows, 4, new Map([[missingId, "missing_profile"]]));
    expect(report.identifiedWithoutProfile).toBe(2);
    expect(report.excluded.profile).toEqual({ persons: 0, byReason: {} });
    expect(report.segments.identified.people).toBe(1);
    expect(report.powerUsers).toHaveLength(1);
  });

  it("segments at person level and removes identified power users from the aggregate", () => {
    const rows = [
      row("anon", "2026-10-01T12:00:00Z", "landing"),
      row("switcher", "2026-10-01T13:00:00Z", "landing"),
      row("switcher", "2026-10-02T13:00:00Z", "home", { identified: true }),
      ...[1, 2, 3, 4].map((day) => row("secret-person", `2026-10-0${day}T15:00:00Z`, "home", { identified: true, sessionId: `s${day}` })),
    ];
    const report = build(rows);
    expect(report.segments.anonymous.people).toBe(1);
    expect(report.segments.identified.people).toBe(1);
    expect(report.segments.identified.families.landing.people).toBe(1);
    expect(report.segments.identified.families.home.people).toBe(1);
    expect(report.powerUsers).toHaveLength(1);
    expect(report.powerUsers[0].key).toBe(createHash("sha256").update("secret-person").digest("hex").slice(0, 10));
    expect(JSON.stringify(report)).not.toContain("secret-person");
    expect(report.segments.identified.families.home.views).toBe(1);
  });

  it("counts ordered session loop prefixes and consecutive distinct family transitions", () => {
    const rows = [
      row("a", "2026-10-02T10:00:00Z", "home"),
      row("a", "2026-10-02T10:01:00Z", "map"),
      row("a", "2026-10-02T10:02:00Z", "map"),
      row("a", "2026-10-02T10:03:00Z", "beach_detail"),
      row("a", "2026-10-02T10:04:00Z", "cams"),
      row("a", "2026-10-02T10:05:00Z", "forecast"),
      row("a", "2026-10-02T10:06:00Z", "nearby"),
      row("b", "2026-10-02T10:00:00Z", "map"),
      row("b", "2026-10-02T10:01:00Z", "home"),
    ];
    const segment = build(rows).segments.anonymous;
    expect(build([...rows].reverse())).toEqual(build(rows));
    expect(Object.values(segment.loopPrefixes).map((value) => value.numerator)).toEqual([1, 1, 1, 1]);
    expect(segment.loopPrefixes.home_map.denominator).toBe(2);
    expect(segment.topTransitions.find((value) => value.from === "map" && value.to === "map")).toBeUndefined();
    expect(segment.topTransitions.find((value) => value.from === "map" && value.to === "beach_detail")?.count).toBe(1);
  });

  it("counts repeat days across the Los Angeles DST fallback", () => {
    const rows = [
      row("repeat", "2026-10-31T08:30:00Z", "water-temp" as WebEventFamily, { family: "utility", surface: "water-temp", localDate: "2026-10-31" }),
      row("repeat", "2026-11-01T08:30:00Z", "utility", { surface: "water-temp", localDate: "2026-11-01" }),
      row("repeat", "2026-11-01T09:30:00Z", "utility", { surface: "water-temp", localDate: "2026-11-01" }),
    ];
    const segment = build(rows).segments.anonymous;
    expect(segment.families.utility.activeDays["2"]).toBe(1);
    expect(segment.families.utility.repeatRate).toEqual({ numerator: 1, denominator: 1, rate: 1 });
    expect(segment.utilitySurfaces["water-temp"].views).toBe(3);
    expect(segment.utilitySurfaces.tide.views).toBe(0);
  });

  it("counts downstream only after the first family event in the same session", () => {
    const rows = [
      row("a", "2026-10-02T10:00:00Z", "map"),
      row("a", "2026-10-02T10:01:00Z", "home"),
      row("a", "2026-10-02T10:02:00Z", "map"),
      row("a", "2026-10-02T10:03:00Z", "forecast"),
      row("a", "2026-10-02T10:04:00Z", "nearby"),
      row("a", "2026-10-02T10:05:00Z", "app_handoff"),
      row("a", "2026-10-02T10:06:00Z", "signup_cta"),
      row("b", "2026-10-02T11:00:00Z", "forecast", { sessionId: "s2" }),
      row("b", "2026-10-02T11:01:00Z", "home", { sessionId: "s2" }),
      row("c", "2026-10-02T12:00:00Z", "home", { sessionId: "s3" }),
      row("c", "2026-10-02T12:00:00Z", "map", { sessionId: "s3" }),
    ];
    const home = build(rows).segments.anonymous.families.home;
    expect(home.sessions).toBe(3);
    expect(home.downstream.map).toEqual({ numerator: 1, denominator: 3, rate: 1 / 3 });
    expect(home.downstream.forecast.numerator).toBe(1);
    expect(home.downstream.nearby.numerator).toBe(1);
    expect(home.downstream.app_handoff.numerator).toBe(1);
    expect(home.downstream.signup_cta.numerator).toBe(1);
  });

  it("uses first-day families for return destinations and flags anonymous heavy in aggregate", () => {
    const rows = [
      row("a", "2026-10-01T10:00:00Z", "home"),
      row("a", "2026-10-01T10:01:00Z", "map"),
      row("a", "2026-10-02T10:00:00Z", "forecast"),
      row("a", "2026-10-03T10:00:00Z", "utility"),
      row("a", "2026-10-04T10:00:00Z", "cams"),
    ];
    const report = build(rows);
    expect(report.anonymousHeavy.people).toBe(1);
    expect(report.segments.anonymous.families.home.returnLoops.firstReturnFamilies).toEqual([{ family: "forecast", people: 1 }]);
    expect(report.segments.anonymous.families.map.returnLoops.returnedPeople).toBe(1);
    expect(report.segments.anonymous.families.forecast.returnLoops.people).toBe(0);
  });
});
