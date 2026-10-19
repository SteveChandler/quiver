/**
 * @jest-environment node
 */

import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import { formatWindowLabel } from "@/lib/notifications/copy/daily-call-copy";
import {
  renderTemplate,
  selectTitle,
  TITLE_MAX_CHARS,
  type SelectTitleArgs,
  type TitleVars,
} from "@/lib/notifications/copy/select-title";
import { dailyCallPayloadSchema } from "@/lib/notifications/types/daily-call";

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
  call: "Your call: Blacks, grab your 7'2.",
  tide: "Rising tide",
  wind: "Offshore wind",
  high_time: "8:15",
  turn_time: "9:00",
  home_beach: "OB",
  window: "6 to 8 AM",
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

    expect(selected.title).toBe("A Very Long Approved Beach… 6 to 8 AM");
    expect(selected.fallback).toBe(true);
  });

  it("keeps the reported Daily Call window in a schema-valid fallback title", () => {
    const selected = selectTitle({
      pool: "daily",
      tags: ["generic", "not-home"],
      userId: "bcacdc51-b01b-4702-ac0b-fb492c0a926a",
      eventKey: "2026-10-10",
      recentTitleIds: [],
      recentFilmCount: 0,
      vars: {
        beach: "Torrance Beach (RAT Beach)",
        home_beach: "Tourmaline",
        window: "10 AM to 12:10 PM",
        lead: "",
        swell: "2-3 ft",
        wind: "light wind",
        limit: "Wind picks up at 2 PM.",
      },
    });

    expect(selected.id).toBe("fallback");
    expect(selected.title).toBe("Torrance Beach 10 AM to 12:10 PM");
    expect([...selected.title].length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(selected.title).toContain("10 AM to 12:10 PM");
    expect(dailyCallPayloadSchema.shape.title.safeParse(selected.title).success).toBe(true);
  });

  it("caps fallback titles across real formatted window labels", () => {
    const recentTitleIds = titlePool.daily.map((entry) => entry.id);
    const timezone = "America/Los_Angeles";

    for (let hour = 5; hour <= 14; hour += 1) {
      for (const startMinute of [0, 15, 47, 58]) {
        for (let duration = 1; duration <= 4; duration += 1) {
          for (const endMinute of [0, 20, 25, 40]) {
            const start = new Date(Date.UTC(2026, 9, 10, hour + 7, startMinute));
            const end = new Date(Date.UTC(2026, 9, 10, hour + duration + 7, endMinute));
            const window = formatWindowLabel(start.toISOString(), end.toISOString(), timezone);

            for (const beach of ["Torrance Beach (RAT Beach)", "A".repeat(45)]) {
              const selected = selectTitle({
                pool: "daily",
                tags: ["generic", "not-home"],
                userId: "user-1",
                eventKey: "2026-10-10",
                recentTitleIds,
                recentFilmCount: 0,
                vars: { ...vars, beach, window },
              });

              expect(selected.id).toBe("fallback");
              expect([...selected.title].length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
            }
          }
        }
      }
    }
  });

  it("omits an overlong single word rather than cutting it while keeping the full window", () => {
    const window = "10 AM to 12:10 PM";
    const selected = selectTitle({
      pool: "daily",
      tags: ["generic"],
      userId: "user-1",
      eventKey: "2026-10-10",
      recentTitleIds: titlePool.daily.map((entry) => entry.id),
      recentFilmCount: 0,
      vars: { ...vars, beach: "A".repeat(45), window },
    });

    expect(selected.title).toBe(`… ${window}`);
    expect([...selected.title].length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(selected.title).toContain(window);
  });

  it("omits the beach when the window alone fills the title cap", () => {
    const window = "A".repeat(TITLE_MAX_CHARS);
    const selected = selectTitle({
      pool: "daily",
      tags: ["generic"],
      userId: "user-1",
      eventKey: "2026-10-10",
      recentTitleIds: titlePool.daily.map((entry) => entry.id),
      recentFilmCount: 0,
      vars: { ...vars, beach: "Blacks", window },
    });

    expect(selected.title).toBe(window);
    expect([...selected.title].length).toBe(TITLE_MAX_CHARS);
  });

  it("preserves a 38-code-point window with an ellipsis instead of cutting beach words", () => {
    const selected = selectTitle({
      pool: "daily",
      tags: ["generic"],
      userId: "user-1",
      eventKey: "2026-10-10",
      recentTitleIds: titlePool.daily.map((entry) => entry.id),
      recentFilmCount: 0,
      vars: { ...vars, beach: "Blacks", window: "A".repeat(38) },
    });

    expect(selected.id).toBe("fallback");
    expect(selected.title).toBe(`… ${"A".repeat(38)}`);
    expect([...selected.title].length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
  });

  it("hard-truncates an oversized swell fallback", () => {
    const rendered = `Swell peaks ${"A".repeat(45)}`;
    const selected = selectTitle(swellArgs({
      recentTitleIds: titlePool.swell.map((entry) => entry.id),
      vars: { ...vars, peak_day: "A".repeat(45) },
    }));

    expect(selected.title).toBe(`${[...rendered].slice(0, TITLE_MAX_CHARS - 1).join("")}…`);
    expect([...selected.title].length).toBe(TITLE_MAX_CHARS);
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
    // 40 researched swell titles + 8 humorous 'coming' titles added with swell follow-ups.
    expect(titlePool.swell).toHaveLength(48);
    // 11 film allusions: "Big Wednesday" (s13) became a plain title in the 2026-09-26 voice pass.
    expect(titlePool.swell.filter((entry) => entry.film)).toHaveLength(11);

    for (const entry of [...titlePool.daily, ...titlePool.swell]) {
      expect([...renderTemplate(entry.title, vars)].length).toBeLessThanOrEqual(
        TITLE_MAX_CHARS,
      );
    }
  });
});


describe("dash-free Daily Call titles", () => {
  it.each([
    ["2026-10-17T15:00:00Z", "2026-10-17T16:00:00Z"],
    ["2026-10-17T15:00:00Z", "2026-10-17T17:00:00Z"],
    ["2026-10-17T18:00:00Z", "2026-10-17T20:00:00Z"],
    ["2026-10-17T13:54:00Z", "2026-10-17T16:00:00Z"],
  ])("keeps every template and fallback dash-free for %s to %s", (start, end) => {
    const window = formatWindowLabel(start, end, "America/Los_Angeles");
    for (const entry of titlePool.daily) {
      const selected = selectTitle({ pool: "daily", tags: entry.tags, userId: "user-1", eventKey: "2026-10-17",
        recentTitleIds: titlePool.daily.filter(({ id }) => id !== entry.id).map(({ id }) => id),
        recentFilmCount: 0, vars: { ...vars, beach: "Torrey Pines", window } });
      expect(selected.title).not.toMatch(/—|–| - /);
      expect([...selected.title].length).toBeLessThanOrEqual(40);
    }
    const selected = selectTitle({ pool: "daily", tags: [], userId: "user-1", eventKey: "2026-10-17",
      recentTitleIds: [], recentFilmCount: 0, vars: { ...vars, beach: "A".repeat(45), window } });
    expect(selected.title).toBe(`… ${window}`);
    expect([...selected.title].length).toBeLessThanOrEqual(40);
    expect(selected.title).not.toMatch(/—|–| - /);
  });
});


describe("beach punctuation in push titles", () => {
  it("removes beach dashes before checking title length", () => {
    const selected = selectTitle({ pool: "daily", tags: [], userId: "user-1", eventKey: "2026-10-17",
      recentTitleIds: [], recentFilmCount: 0, vars: { ...vars, beach: "Waikiki – Canoes", window: "8 to 10 AM" } });
    expect(selected.title).toBe("Waikiki Canoes 8 to 10 AM");
  });
});


describe("Daily Call beach word boundaries", () => {
  it.each([
    [29, "A Very Long Approved Bay Cove", "A Very Long Approved Bay Cove 8 to 10 AM"],
    [32, "A Very Long Approved Sandy Beach", "A Very Long Approved Sandy… 8 to 10 AM"],
    [36, "A Very Long Approved Shoreline Beach", "A Very Long Approved… 8 to 10 AM"],
  ])("keeps whole words for a %i-character beach name", (length, beach, title) => {
    expect([...beach]).toHaveLength(length);
    const selected = selectTitle(swellArgs({
      pool: "daily", tags: ["generic"], vars: { ...vars, beach, window: "8 to 10 AM" },
    }));
    expect(selected).toMatchObject({ id: "fallback", title, fallback: true });
    expect([...selected.title].length).toBeLessThanOrEqual(40);
  });

  it("preserves a complete beach word and window at exactly 40 characters", () => {
    const selected = selectTitle(swellArgs({
      pool: "daily", tags: [],
      vars: { ...vars, beach: "A Very Long Approved Coastal Beach Name", window: "8 to 10 AM" },
    }));
    expect(selected.title).toBe("A Very Long Approved Coastal… 8 to 10 AM");
    expect([...selected.title]).toHaveLength(40);
  });

  it("uses a shorter fitting template for Huntington Beach Pier before falling back to plain", () => {
    const selected = selectTitle(swellArgs({
      pool: "daily", tags: ["swell-day"], eventKey: "event-2",
      vars: { ...vars, beach: "Huntington Beach Pier", window: "8 AM" },
    }));
    expect(selected).toMatchObject({ id: "d34", title: "Swell day. Huntington Beach Pier 8 AM", fallback: false });
  });

  it("keeps Huntington Beach Pier whole in the plain form when no template fits", () => {
    const selected = selectTitle(swellArgs({
      pool: "daily", tags: ["swell-day"], vars: { ...vars, beach: "Huntington Beach Pier", window: "8 to 10 AM" },
    }));
    expect(selected).toMatchObject({ id: "fallback", title: "Huntington Beach Pier 8 to 10 AM", fallback: true });
  });
});
