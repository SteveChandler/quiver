/**
 * @jest-environment node
 */

import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import {
  renderTemplate,
  selectTitle,
  TITLE_MAX_CHARS,
  type SelectTitleArgs,
  type TitleVars,
} from "@/lib/notifications/copy/select-title";

const vars: TitleVars = {
  beach: "Blacks",
  start: "6:00",
  end: "8:00",
  beach1: "Blacks",
  beach2: "Scripps",
  beach3: "Osprey",
  size: "4ft",
  period: "14s",
  dir: "SW",
  peak_day: "Wed",
  peak_part: "AM",
  rarity: "Best this month",
  tide: "Rising tide",
  wind: "Offshore wind",
  high_time: "8:15",
  turn_time: "9:00",
  home_beach: "OB",
  window: "6–8 AM",
  lead: "",
  swell: "4–5 ft at 14s SW",
  limit: "Best before the wind picks up around 8 AM.",
};

const allSwellTags = [
  "hawaii",
  "biggest-in-weeks",
  "first-after-flat",
  "weekend",
  "weekday",
  "long-period",
  "south",
  "northwest",
  "manageable",
  "generic",
];

function swellArgs(overrides: Partial<SelectTitleArgs> = {}): SelectTitleArgs {
  return {
    pool: "swell",
    tags: allSwellTags,
    userId: "user-1",
    eventKey: "event-1",
    recentTitleIds: [],
    recentFilmCount: 0,
    vars,
    ...overrides,
  };
}

describe("selectTitle", () => {
  it("only selects entries whose tags are proven", () => {
    const selectedIds = Array.from({ length: 25 }, (_, index) =>
      selectTitle(swellArgs({
        tags: ["biggest-in-weeks", "manageable"],
        eventKey: `event-${index}`,
      })).id,
    );

    expect(selectedIds).not.toContain("s11");
    expect(selectedIds.every((id) => {
      const entry = titlePool.swell.find((candidate) => candidate.id === id);
      return entry?.tags.every((tag) => ["biggest-in-weeks", "manageable"].includes(tag));
    })).toBe(true);
  });

  it("uses only serious entries when serious is proven", () => {
    const selected = selectTitle(swellArgs({
      tags: ["serious", ...allSwellTags],
    }));
    const entry = titlePool.swell.find((candidate) => candidate.id === selected.id);

    expect(entry?.tags).toContain("serious");
  });

  it("drops film allusions after one of the last three swell sends", () => {
    const uncapped = selectTitle(swellArgs());
    const capped = selectTitle(swellArgs({ recentFilmCount: 1 }));
    const uncappedEntry = titlePool.swell.find((entry) => entry.id === uncapped.id);
    const cappedEntry = titlePool.swell.find((entry) => entry.id === capped.id);

    expect(uncappedEntry?.film).toBe(true);
    expect(cappedEntry?.film).toBe(false);
  });

  it("excludes recently sent titles", () => {
    const args: SelectTitleArgs = {
      pool: "daily",
      tags: ["generic"],
      userId: "user-1",
      eventKey: "event-1",
      recentTitleIds: [],
      recentFilmCount: 0,
      vars,
    };
    const first = selectTitle(args);
    const next = selectTitle({ ...args, recentTitleIds: [first.id] });

    expect(next.id).not.toBe(first.id);
  });

  it("uses a stable hash while allowing event keys to rotate titles", () => {
    const args = swellArgs({ tags: ["biggest-in-weeks", "weekday"] });

    expect(selectTitle(args).id).toBe(selectTitle(args).id);
    expect(new Set(Array.from({ length: 20 }, (_, index) =>
      selectTitle({ ...args, eventKey: `event-${index}` }).id,
    )).size).toBeGreaterThan(1);
  });

  it("falls back when no rendered candidate fits the title limit", () => {
    const selected = selectTitle({
      pool: "daily",
      tags: ["generic"],
      userId: "user-1",
      eventKey: "event-1",
      recentTitleIds: [],
      recentFilmCount: 0,
      vars: {
        ...vars,
        beach: "A Very Long Approved Beach Name",
      },
    });

    expect(selected.title).toBe("A Very Long Approved Beach Name 6–8 AM");
    expect(selected.fallback).toBe(true);
  });
});

describe("renderTemplate", () => {
  it("throws when a template variable is missing", () => {
    expect(() => renderTemplate("Go {beach} at {missing}", vars)).toThrow(
      "Missing template variable: missing",
    );
  });
});

describe("surf title pool", () => {
  it("loads every researched entry within the template title limit", () => {
    expect(titlePool.version).toBe(1);
    // 30 researched daily titles + 4 swell-day variants added with the swell alert producer.
    expect(titlePool.daily).toHaveLength(34);
    expect(titlePool.swell).toHaveLength(40);
    expect(titlePool.swell.filter((entry) => entry.film)).toHaveLength(12);

    for (const entry of [...titlePool.daily, ...titlePool.swell]) {
      expect([...renderTemplate(entry.title, vars)].length).toBeLessThanOrEqual(
        TITLE_MAX_CHARS,
      );
    }
  });
});
