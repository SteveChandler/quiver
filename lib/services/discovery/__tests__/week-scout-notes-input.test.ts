import { beforeEach, describe, expect, it } from "@jest/globals";

const mockGenerate = jest.fn();
const mockPool = jest.fn();
const mockLoadLatestInput = jest.fn();
const mockSaveInput = jest.fn();

jest.mock("@/lib/services/discovery/week-scout", () => ({
  generateWeekScoutForecast: (...args: unknown[]) => mockGenerate(...args),
}));
jest.mock("@/lib/services/discovery/weekend-scout-candidate-pool", () => ({
  buildDriveRangeCandidatePool: (...args: unknown[]) => mockPool(...args),
}));
jest.mock("@/lib/services/discovery/swell-briefing-store", () => ({
  loadLatestBriefingInput: (...args: unknown[]) => mockLoadLatestInput(...args),
  saveBriefingInput: (...args: unknown[]) => mockSaveInput(...args),
}));

import { briefingInputHash } from "../swell-briefing-hash";
import type { WeekScoutNoteCopyFact } from "../swell-briefing-types";
import { buildWeekScoutNoteFacts, buildWeekScoutNotesInput } from "../week-scout-notes-input";

const USER = "23a9c100-dbee-4d1b-9178-3456a45935ad";
const BLACKS = "6f1c1f3e-2b8a-4a55-9a43-0d1f3e1d6a01";
const FIFTEENTH = "6f1c1f3e-2b8a-4a55-9a43-0d1f3e1d6a02";
const HOME = "6f1c1f3e-2b8a-4a55-9a43-0d1f3e1d6a03";
const NAMES = new Map([[BLACKS, "Blacks"], [FIFTEENTH, "15th Street"]]);

function day(
  localDate: string,
  best: { beachId: string; verdict: "worth_it" | "maybe" | "skip" | null; bucket: string } | null,
  earlyLook = false,
) {
  return {
    localDate,
    ...(earlyLook ? { earlyLook: true } : {}),
    windows: [],
    bestWindowId: best ? `${localDate}-w` : null,
    bestDayWindow: best,
    exclusionReasons: [],
  };
}

function forecast(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-10-27T12:30:00.000Z",
    days: [
      day("2026-10-27", { beachId: BLACKS, verdict: "maybe", bucket: "morning" }),
      day("2026-10-28", { beachId: BLACKS, verdict: "worth_it", bucket: "evening" }),
      day("2026-10-29", null),
      day("2026-10-30", { beachId: FIFTEENTH, verdict: "worth_it", bucket: "midday" }),
      day("2026-11-04", { beachId: BLACKS, verdict: "worth_it", bucket: "morning" }, true),
    ],
    swells: [{ eventKey: `${BLACKS}:W:2026-10-30:p`, confidence: "likely" }],
    ...overrides,
  } as never;
}

function bySlot(facts: WeekScoutNoteCopyFact[], slot: string): WeekScoutNoteCopyFact[] {
  return facts.filter((fact) => fact.slot === slot);
}

describe("buildWeekScoutNoteFacts", () => {
  it("never offers a candidate with a number in it", () => {
    const facts = buildWeekScoutNoteFacts(forecast(), NAMES);
    expect(facts.length).toBeGreaterThan(0);
    for (const fact of facts) expect(fact.text).not.toMatch(/\d/);
  });

  it("gates each day note on that day's pick: beach, verdict and part of day", () => {
    const facts = bySlot(buildWeekScoutNoteFacts(forecast(), NAMES), "day:2026-10-28");
    expect(facts.map((fact) => fact.text)).toEqual(["Blacks in the evening looks worth it.", "Worth it in the evening."]);
    for (const fact of facts) {
      expect(fact.gate).toEqual({
        days: [{ localDate: "2026-10-28", beachId: BLACKS, verdict: "worth_it", bucket: "evening" }],
        swells: [],
      });
    }
  });

  it("offers nothing for a day without a pick or with a held verdict", () => {
    const facts = buildWeekScoutNoteFacts(
      forecast({ days: [day("2026-10-29", null), day("2026-10-30", { beachId: BLACKS, verdict: null, bucket: "morning" })] }),
      NAMES,
    );
    expect(bySlot(facts, "day:2026-10-29")).toEqual([]);
    expect(bySlot(facts, "day:2026-10-30")).toEqual([]);
  });

  it("leaves out a beach whose name has a number in it", () => {
    const facts = bySlot(buildWeekScoutNoteFacts(forecast(), NAMES), "day:2026-10-30");
    expect(facts.map((fact) => fact.text)).toEqual(["Worth it around midday."]);
  });

  it("hedges early-look days and keeps them out of the headline", () => {
    const facts = buildWeekScoutNoteFacts(forecast(), NAMES);
    for (const fact of bySlot(facts, "day:2026-11-04")) expect(fact.text).toMatch(/^Early look\. /);
    for (const fact of bySlot(facts, "headline")) {
      expect(fact.gate.days.map((gate) => gate.localDate)).not.toContain("2026-11-04");
    }
  });

  it("rests each headline on the days or swell it names", () => {
    const headlines = bySlot(buildWeekScoutNoteFacts(forecast(), NAMES), "headline");
    expect(headlines.map((fact) => [fact.text, fact.gate.days.map((gate) => gate.localDate)])).toEqual([
      ["Wednesday looks worth it.", ["2026-10-28"]],
      ["Wednesday at Blacks looks worth it.", ["2026-10-28"]],
      ["Wednesday and Friday both look worth it.", ["2026-10-28", "2026-10-30"]],
    ]);
  });

  it("offers a maybe headline only when no day is worth it, and a swell headline only when locked", () => {
    const headlines = bySlot(buildWeekScoutNoteFacts(forecast({
      days: [day("2026-10-27", { beachId: BLACKS, verdict: "maybe", bucket: "morning" })],
      swells: [{ eventKey: "swell-a", confidence: "locked" }],
    }), NAMES), "headline");
    expect(headlines.map((fact) => fact.text)).toEqual(["Maybe on Tuesday. Check before you go.", "A swell is locked in."]);
    expect(headlines[1].gate).toEqual({ days: [], swells: [{ eventKey: "swell-a", confidence: "locked" }] });
  });

  it("gates swell notes on the swell and its confidence", () => {
    const facts = bySlot(buildWeekScoutNoteFacts(forecast(), NAMES), `swell:${BLACKS}:W:2026-10-30:p`);
    expect(facts).toHaveLength(2);
    for (const fact of facts) {
      expect(fact.gate).toEqual({ days: [], swells: [{ eventKey: `${BLACKS}:W:2026-10-30:p`, confidence: "likely" }] });
    }
  });

  it("words swell notes so they stay true if the swell firms up, since the gate is a floor", () => {
    const texts = (confidence: string) => buildWeekScoutNoteFacts(forecast({ days: [], swells: [{ eventKey: "s", confidence }] }), NAMES)
      .filter((fact) => fact.slot === "swell:s")
      .map((fact) => fact.text);
    expect(texts("on_the_radar")).toEqual(["On the radar.", "One to watch."]);
    expect(texts("likely")).toEqual(["Looking likely.", "Likely, and worth watching."]);
    expect(texts("locked")).toEqual(["Locked in.", "The forecast has settled on this one."]);
  });

  it("issues ids the worker accepts, unique across the input", () => {
    const ids = buildWeekScoutNoteFacts(forecast(), NAMES).map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9._:-]{1,100}$/);
  });
});

function client(profile: Record<string, unknown> | null) {
  return {
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => {
            if (table === "profiles") return { data: profile, error: null };
            if (table === "beaches") return { data: { lat: 32.88, lon: -117.25 }, error: null };
            return { data: null, error: null };
          }),
        })),
      })),
    })),
  } as never;
}

describe("buildWeekScoutNotesInput", () => {
  const now = new Date("2026-10-27T12:30:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockResolvedValue(forecast());
    mockPool.mockResolvedValue({ candidates: [{ beach: { id: BLACKS, name: "Blacks" } }, { beach: { id: FIFTEENTH, name: "15th Street" } }] });
    mockLoadLatestInput.mockResolvedValue(null);
    mockSaveInput.mockResolvedValue(undefined);
  });

  it("builds the pilot's 10-day scout the way the route does and saves a hashed v2 input", async () => {
    const snapshot = await buildWeekScoutNotesInput({
      client: client({ home_beach_id: HOME, max_drive_minutes: 60, preferred_session_time: null, experience_level: "advanced" }),
      userId: USER,
      regionSlug: "san-diego",
      now,
    });

    expect(mockGenerate).toHaveBeenCalledWith(USER, expect.objectContaining({
      candidateBeachIds: [BLACKS, FIFTEENTH],
      localTimezone: "America/Los_Angeles",
      startLocalDate: "2026-10-27",
      dayCount: 10,
      includeSwells: true,
      requirePerRowFreshness: true,
      userLocation: { lat: 32.88, lon: -117.25 },
    }));
    expect(snapshot).toMatchObject({
      schemaVersion: 2,
      userId: USER,
      region: "san-diego",
      editionDate: "2026-10-27",
      sourcePublishedAt: "2026-10-27T12:30:00.000Z",
      validUntil: "2026-10-29T06:59:59.000Z",
      briefing: { schemaVersion: 2, kind: "week_scout_notes", editionDate: "2026-10-27", notes: [] },
    });
    expect(snapshot.inputHash).toBe(briefingInputHash(snapshot as unknown as Record<string, unknown>));
    expect(mockLoadLatestInput).toHaveBeenCalledWith(expect.anything(), USER, "san-diego", "2026-10-27", 2);
    expect(mockSaveInput).toHaveBeenCalledWith(expect.anything(), snapshot);
  });

  it("reissues the saved input when the candidates have not moved", async () => {
    const args = { client: client({ home_beach_id: HOME }), userId: USER, regionSlug: "san-diego", now };
    const first = await buildWeekScoutNotesInput(args);
    mockLoadLatestInput.mockResolvedValue(first);
    mockSaveInput.mockClear();

    const second = await buildWeekScoutNotesInput({ ...args, now: new Date("2026-10-27T14:00:00.000Z") });
    expect(second).toBe(first);
    expect(mockSaveInput).not.toHaveBeenCalled();
  });

  it("refuses to issue an input with nothing to pick", async () => {
    mockGenerate.mockResolvedValue(forecast({ days: [day("2026-10-27", null)], swells: [] }));
    await expect(buildWeekScoutNotesInput({ client: client({ home_beach_id: HOME }), userId: USER, regionSlug: "san-diego", now }))
      .rejects.toMatchObject({ message: "no_note_candidates", status: 409 });
    expect(mockSaveInput).not.toHaveBeenCalled();
  });

  it("refuses a pilot with no home break or recent location", async () => {
    await expect(buildWeekScoutNotesInput({ client: client({ home_beach_id: null }), userId: USER, regionSlug: "san-diego", now }))
      .rejects.toMatchObject({ message: "pilot_has_no_anchor", status: 409 });
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
