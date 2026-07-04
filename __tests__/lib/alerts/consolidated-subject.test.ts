import { buildConsolidatedSubject } from "@/lib/alerts/consolidated-subject";
import type { MatchingWindow } from "@/lib/alerts/types";

function match(overrides: Partial<MatchingWindow> = {}): MatchingWindow {
  return {
    rule_id: "rule-1",
    rule_name: "Dawn Patrol",
    beach_id: "beach-1",
    beach_name: "Lower Trestles",
    beach_slug: "lower-trestles",
    beach_timezone: "America/Los_Angeles",
    window_start: "2026-04-04T15:00:00.000Z",
    window_end: "2026-04-04T17:00:00.000Z",
    best_hour: "2026-04-04T16:00:00.000Z",
    best_score: 0.75,
    conditions_snapshot: {
      wave_height: 5,
      swell_1_period: 15,
    },
    notify_email: true,
    notify_push: true,
    ...overrides,
  };
}

describe("buildConsolidatedSubject", () => {
  it("leads with payload details for a single match", () => {
    expect(buildConsolidatedSubject([match()], "Saturday, April 4")).toBe(
      "Lower Trestles firing: 5 ft @ 15s this morning"
    );
  });

  it("falls back when snapshot numbers are missing", () => {
    expect(
      buildConsolidatedSubject(
        [match({ conditions_snapshot: { wave_height: 5 } })],
        "Saturday, April 4"
      )
    ).toBe("Lower Trestles: surf window this morning");
  });

  it("uses the top-scored beach for multi-match subjects", () => {
    expect(
      buildConsolidatedSubject(
        [
          match({ beach_name: "Bolsa Chica", best_score: 0.5 }),
          match({ beach_name: "Blacks", best_score: 0.9 }),
          match({ beach_name: "Swamis", best_score: 0.7 }),
        ],
        "Saturday, April 4"
      )
    ).toBe("Blacks + 2 more spots firing Saturday");
  });

  it("keeps surf numbers while truncating long beach names", () => {
    const subject = buildConsolidatedSubject(
      [
        match({
          beach_name:
            "Lower Trestles Super Long Beach Name That Would Otherwise Overrun Inbox",
        }),
      ],
      "Saturday, April 4"
    );

    expect(subject.length).toBeLessThanOrEqual(78);
    expect(subject).toContain("5 ft @ 15s");
    expect(subject).toContain("...");
  });

  it("labels morning, afternoon, and evening windows in the beach timezone", () => {
    expect(
      buildConsolidatedSubject(
        [match({ window_start: "2026-04-04T15:00:00.000Z" })],
        "Saturday, April 4"
      )
    ).toContain("this morning");
    expect(
      buildConsolidatedSubject(
        [match({ window_start: "2026-04-04T21:00:00.000Z" })],
        "Saturday, April 4"
      )
    ).toContain("this afternoon");
    expect(
      buildConsolidatedSubject(
        [match({ window_start: "2026-04-05T02:00:00.000Z" })],
        "Saturday, April 4"
      )
    ).toContain("this evening");
  });
});
