import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

const mockLoadLatestEdition = jest.fn();
jest.mock("@/lib/services/discovery/swell-briefing-store", () => ({
  loadLatestBriefingEdition: (...args: unknown[]) => mockLoadLatestEdition(...args),
}));

import { loadBriefingForOutlook } from "../swell-briefing-serve";
import type { WeekScoutNotesBriefing } from "../swell-briefing-types";
import {
  gateHolds,
  liveWeekScoutNotes,
  loadWeekScoutNotesEdition,
} from "../week-scout-notes-serve";

const USER = "23a9c100-dbee-4d1b-9178-3456a45935ad";
const BLACKS = "6f1c1f3e-2b8a-4a55-9a43-0d1f3e1d6a01";
const SCRIPPS = "6f1c1f3e-2b8a-4a55-9a43-0d1f3e1d6a02";
const NOW = new Date("2026-10-27T13:00:00.000Z");

const wed = { localDate: "2026-10-28", beachId: BLACKS, verdict: "worth_it" as const, bucket: "evening" as const };
const thu = { localDate: "2026-10-29", beachId: SCRIPPS, verdict: "maybe" as const, bucket: "morning" as const };
const swell = { eventKey: "swell-a", confidence: "likely" as const };

function live(overrides: { days?: Array<Record<string, unknown>>; swells?: Array<Record<string, unknown>> } = {}) {
  return {
    days: overrides.days ?? [
      { localDate: "2026-10-28", bestDayWindow: { beachId: BLACKS, verdict: "worth_it", bucket: "evening" } },
      { localDate: "2026-10-29", bestDayWindow: { beachId: SCRIPPS, verdict: "maybe", bucket: "morning" } },
    ],
    swells: overrides.swells ?? [{ eventKey: "swell-a", confidence: "likely" }],
  } as never;
}

function edition(): WeekScoutNotesBriefing {
  return {
    schemaVersion: 2,
    kind: "week_scout_notes",
    editionDate: "2026-10-27",
    generatedAt: "2026-10-27T12:45:00Z",
    notes: [
      { slot: "headline", text: "Wednesday and Thursday both look good.", gate: { days: [wed, thu], swells: [] } },
      { slot: "day:2026-10-28", text: "Blacks in the evening looks worth it.", gate: { days: [wed], swells: [] } },
      { slot: "day:2026-10-29", text: "A maybe. Check it before you commit.", gate: { days: [thu], swells: [] } },
      { slot: "swell:swell-a", text: "Likely, and still firming up.", gate: { days: [], swells: [swell] } },
    ],
  };
}

describe("gateHolds", () => {
  it("holds while each day's live pick is the same beach, verdict and part of day", () => {
    expect(gateHolds({ days: [wed, thu], swells: [] }, live())).toBe(true);
  });

  it("fails when the live pick moved beach, verdict or part of day, or the day is gone", () => {
    for (const best of [
      { beachId: SCRIPPS, verdict: "worth_it", bucket: "evening" },
      { beachId: BLACKS, verdict: "maybe", bucket: "evening" },
      { beachId: BLACKS, verdict: "worth_it", bucket: "morning" },
      null,
    ]) {
      expect(gateHolds({ days: [wed], swells: [] }, live({ days: [{ localDate: "2026-10-28", bestDayWindow: best }] }))).toBe(false);
    }
    expect(gateHolds({ days: [wed], swells: [] }, live({ days: [] }))).toBe(false);
  });

  it("holds a swell gate while the swell is listed and no less certain", () => {
    expect(gateHolds({ days: [], swells: [swell] }, live({ swells: [{ eventKey: "swell-a", confidence: "locked" }] }))).toBe(true);
    expect(gateHolds({ days: [], swells: [swell] }, live({ swells: [{ eventKey: "swell-a", confidence: "on_the_radar" }] }))).toBe(false);
    expect(gateHolds({ days: [], swells: [swell] }, live({ swells: [] }))).toBe(false);
    expect(gateHolds({ days: [], swells: [swell] }, { days: [] } as never)).toBe(false);
  });

  it("withholds a note with nothing to check or an unreadable gate", () => {
    expect(gateHolds({ days: [], swells: [] }, live())).toBe(false);
    expect(gateHolds(null, live())).toBe(false);
    expect(gateHolds({ days: "all" } as never, live())).toBe(false);
    expect(gateHolds({ days: [], swells: [{ eventKey: "swell-a", confidence: "huge" }] } as never, live())).toBe(false);
  });
});

describe("liveWeekScoutNotes", () => {
  it("sends the headline and notes as slot and text only", () => {
    const wire = liveWeekScoutNotes(edition(), live());
    expect(wire).toEqual({
      headline: "Wednesday and Thursday both look good.",
      notes: [
        { slot: "day:2026-10-28", text: "Blacks in the evening looks worth it." },
        { slot: "day:2026-10-29", text: "A maybe. Check it before you commit." },
        { slot: "swell:swell-a", text: "Likely, and still firming up." },
      ],
    });
    for (const note of wire?.notes ?? []) expect(Object.keys(note).sort()).toEqual(["slot", "text"]);
    expect(Object.keys(wire ?? {}).sort()).toEqual(["headline", "notes"]);
  });

  it("drops a day note and the headline resting on it when that day's pick changes", () => {
    const wire = liveWeekScoutNotes(edition(), live({
      days: [
        { localDate: "2026-10-28", bestDayWindow: { beachId: BLACKS, verdict: "worth_it", bucket: "evening" } },
        { localDate: "2026-10-29", bestDayWindow: { beachId: SCRIPPS, verdict: "skip", bucket: "morning" } },
      ],
    }));
    expect(wire).toEqual({
      notes: [
        { slot: "day:2026-10-28", text: "Blacks in the evening looks worth it." },
        { slot: "swell:swell-a", text: "Likely, and still firming up." },
      ],
    });
  });

  it("returns null when nothing survives", () => {
    expect(liveWeekScoutNotes(edition(), live({ days: [], swells: [] }))).toBeNull();
  });

  it("ignores slots it does not know", () => {
    const stored = edition();
    stored.notes = [{ slot: "todayCall", text: "Go now.", gate: { days: [wed], swells: [] } }];
    expect(liveWeekScoutNotes(stored, live())).toBeNull();
  });
});

describe("loading editions", () => {
  const client = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SWELL_BRIEFING_ENABLED = "true";
    process.env.SWELL_BRIEFING_PILOT_USER_ID = USER;
  });

  afterEach(() => {
    delete process.env.SWELL_BRIEFING_ENABLED;
    delete process.env.SWELL_BRIEFING_PILOT_USER_ID;
  });

  function stored(schemaVersion: 1 | 2, validUntil = "2026-10-29T06:59:59.000Z") {
    return { schemaVersion, validUntil, briefing: schemaVersion === 2 ? edition() : { headline: "v1", dataAt: "2026-10-27T12:00:00Z", generatedAt: "2026-10-27T12:00:00Z" } };
  }

  it("loads the pilot's notes edition by kind", async () => {
    mockLoadLatestEdition.mockResolvedValue(stored(2));
    await expect(loadWeekScoutNotesEdition({ client, userId: USER, now: NOW })).resolves.toEqual(edition());
    expect(mockLoadLatestEdition).toHaveBeenCalledWith(client, USER, "san-diego", { kind: "week_scout_notes" });
  });

  it("serves nothing past valid_until, to anyone but the pilot, or when the read fails", async () => {
    mockLoadLatestEdition.mockResolvedValue(stored(2, "2026-10-27T12:59:59.000Z"));
    await expect(loadWeekScoutNotesEdition({ client, userId: USER, now: NOW })).resolves.toBeNull();

    mockLoadLatestEdition.mockResolvedValue(stored(2));
    await expect(loadWeekScoutNotesEdition({ client, userId: "someone-else", now: NOW })).resolves.toBeNull();

    delete process.env.SWELL_BRIEFING_ENABLED;
    await expect(loadWeekScoutNotesEdition({ client, userId: USER, now: NOW })).resolves.toBeNull();
    process.env.SWELL_BRIEFING_ENABLED = "true";

    mockLoadLatestEdition.mockRejectedValue(new Error("briefing_edition_read_failed"));
    await expect(loadWeekScoutNotesEdition({ client, userId: USER, now: NOW })).resolves.toBeNull();
  });

  it("gives the Outlook no briefing once the newest edition is Week Scout notes", async () => {
    mockLoadLatestEdition.mockResolvedValue(stored(2));
    await expect(loadBriefingForOutlook({ client, userId: USER, now: NOW })).resolves.toBeNull();
    expect(mockLoadLatestEdition).toHaveBeenCalledWith(client, USER, "san-diego");

    mockLoadLatestEdition.mockResolvedValue(stored(1));
    await expect(loadBriefingForOutlook({ client, userId: USER, now: NOW })).resolves.toMatchObject({ headline: "v1" });
  });
});
