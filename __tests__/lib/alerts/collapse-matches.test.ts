import { collapseSameWindowMatches, firstMatchPerBeach } from "@/lib/alerts/collapse-matches";
import type { MatchingWindow } from "@/lib/alerts/types";

function match(overrides: Partial<MatchingWindow> = {}): MatchingWindow {
  return {
    rule_id: "rule-1",
    rule_name: "Mellow session",
    beach_id: "pacifica",
    beach_name: "Pacifica / Linda Mar",
    beach_timezone: "America/Los_Angeles",
    window_start: "2026-11-01T18:00:00+00:00",
    window_end: "2026-11-01T19:00:00.000Z",
    best_hour: "2026-11-01T18:00:00+00:00",
    best_score: 0.64,
    conditions_snapshot: {},
    notify_email: true,
    notify_push: false,
    ...overrides,
  };
}

describe("collapseSameWindowMatches", () => {
  it("keeps the best score when two rules match one beach and window, across ISO spellings", () => {
    const mellow = match();
    const weekend = match({ rule_id: "rule-2", window_start: "2026-11-01T18:00:00.000Z", best_score: 0.75 });
    expect(collapseSameWindowMatches([mellow, weekend])).toEqual([weekend]);
  });

  it("keeps the canonical primary even with a lower score", () => {
    const primary = match();
    const higher = match({ rule_id: "rule-2", best_score: 0.9 });
    expect(collapseSameWindowMatches([primary, higher], primary)).toEqual([primary]);
    expect(collapseSameWindowMatches([higher, primary], primary)).toEqual([primary]);
  });

  it("keeps windows that differ in start or end, and other beaches, in first-seen order", () => {
    const morning = match();
    const longer = match({ rule_id: "rule-2", window_end: "2026-11-01T21:00:00Z" });
    const afternoon = match({ rule_id: "rule-3", window_start: "2026-11-01T22:00:00Z", window_end: "2026-11-01T23:00:00Z" });
    const other = match({ beach_id: "capitola", beach_name: "Capitola" });
    expect(collapseSameWindowMatches([morning, other, longer, afternoon])).toEqual([morning, other, longer, afternoon]);
  });
});

describe("firstMatchPerBeach", () => {
  it("returns one match per beach in the given order", () => {
    const a = match();
    const b = match({ rule_id: "rule-2" });
    const c = match({ beach_id: "capitola" });
    expect(firstMatchPerBeach([a, c, b])).toEqual([a, c]);
  });
});
