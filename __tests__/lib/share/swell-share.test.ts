/** @jest-environment node */
import {
  buildSwellCard,
  buildSwellAppUrl,
  buildSwellCardView,
  buildSwellImagePath,
  buildSwellSharePath,
  describeSwellHistory,
  loadSwellShareEvent,
  parseSwellEventKey,
  parseSwellImageFormat,
  parseSwellKind,
  parseSwellTitleId,
} from "@/lib/share/swell-share";
import followupPool from "@/lib/notifications/copy/swell-followup-titles.v1.json";
import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import {
  fakeSwellSupabase,
  swellSnapshot,
  SWELL_BEACH_ID,
  SWELL_EVENT_KEY,
  SWELL_NOW,
} from "@/__tests__/helpers/swell-share-fixtures";

interface PoolEntry {
  id: string;
  title: string;
  tags: string[];
}

function poolFor(kind: string): PoolEntry[] {
  return kind === "coming"
    ? titlePool.swell
    : (followupPool as unknown as Record<string, PoolEntry[]>)[kind];
}

const load = (db: Parameters<typeof fakeSwellSupabase>[0], now = SWELL_NOW) =>
  loadSwellShareEvent(fakeSwellSupabase(db), SWELL_EVENT_KEY, now);

describe("swell share param parsing", () => {
  it("accepts plain, encoded and suffixed event keys", () => {
    expect(parseSwellEventKey(SWELL_EVENT_KEY)).toEqual({
      eventKey: SWELL_EVENT_KEY,
      beachId: SWELL_BEACH_ID,
    });
    expect(parseSwellEventKey(encodeURIComponent(SWELL_EVENT_KEY))?.eventKey).toBe(SWELL_EVENT_KEY);
    expect(parseSwellEventKey(`${SWELL_EVENT_KEY}:2`)?.eventKey).toBe(`${SWELL_EVENT_KEY}:2`);
  });

  it("lowercases the beach uuid but not the direction band", () => {
    const upper = `${SWELL_BEACH_ID.toUpperCase()}:NW:2026-10-08`;
    expect(parseSwellEventKey(upper)).toEqual({ eventKey: SWELL_EVENT_KEY, beachId: SWELL_BEACH_ID });
  });

  it.each([
    "",
    "nope",
    "%E0%A4%A",
    `${SWELL_BEACH_ID}:NW`,
    `${SWELL_BEACH_ID}:<b>:2026-10-08`,
    `${SWELL_BEACH_ID}:NW:2026-10-08;drop`,
    `not-a-uuid:NW:2026-10-08`,
  ])("rejects %p", (value) => {
    expect(parseSwellEventKey(value)).toBeNull();
  });

  it("falls back for unknown kind, title id and format", () => {
    expect(parseSwellKind("moved")).toBe("moved");
    expect(parseSwellKind("<script>")).toBe("coming");
    expect(parseSwellKind(undefined)).toBe("coming");
    expect(parseSwellTitleId("s35")).toBe("s35");
    expect(parseSwellTitleId("Cancel your plans")).toBeUndefined();
    expect(parseSwellTitleId("x".repeat(40))).toBeUndefined();
    expect(parseSwellImageFormat("card")).toBe("card");
    expect(parseSwellImageFormat("poster")).toBe("og");
  });

  it("encodes the event key in every URL", () => {
    const encoded = encodeURIComponent(SWELL_EVENT_KEY);
    expect(buildSwellSharePath(SWELL_EVENT_KEY, "bigger", "s1")).toBe(`/app/swell/${encoded}?k=bigger&t=s1`);
    expect(buildSwellAppUrl(SWELL_EVENT_KEY, "coming")).toBe(`quiver://swell/${encoded}?k=coming`);
    expect(buildSwellImagePath(SWELL_EVENT_KEY, "coming", null, "card")).toBe(
      `/api/og/swell?event_key=${encoded}&k=coming&format=card`,
    );
  });
});

describe("loadSwellShareEvent", () => {
  it("returns the contract payload with history oldest first", async () => {
    const supabase = fakeSwellSupabase({
      snapshots: [
        swellSnapshot({ run_date: "2026-10-02", detected_at: "2026-10-02T14:30:00.000Z", peak_face_height_ft: 4.24, peak_at: "2026-10-07T21:00:00.000Z" }),
        swellSnapshot(),
      ],
    });
    const event = await loadSwellShareEvent(supabase, SWELL_EVENT_KEY, SWELL_NOW);

    expect(event?.payload).toEqual({
      eventKey: SWELL_EVENT_KEY,
      beach: { id: SWELL_BEACH_ID, name: "Trinidad State Beach", slug: "trinidad-state-beach-ca" },
      status: "forecast",
      faceHeightFt: 5.6,
      periodS: 14,
      directionLabel: "WNW",
      peakAt: "2026-10-08T15:00:00.000Z",
      peakLocalDate: "2026-10-08",
      history: [
        { runDate: "2026-10-02", peakAt: "2026-10-07T21:00:00.000Z", faceHeightFt: 4.2, periodS: 14 },
        { runDate: "2026-10-03", peakAt: "2026-10-08T15:00:00.000Z", faceHeightFt: 5.6, periodS: 14 },
      ],
    });
    expect(supabase.filters).toEqual(
      expect.arrayContaining([
        ["swell_event_forecast_snapshots.beach_id", SWELL_BEACH_ID],
        ["swell_event_forecast_snapshots.event_key", SWELL_EVENT_KEY],
        ["beaches.id", SWELL_BEACH_ID],
      ]),
    );
  });

  it("returns null for a bad key, no snapshots, or a missing beach", async () => {
    expect(await loadSwellShareEvent(fakeSwellSupabase({ snapshots: [swellSnapshot()] }), "nope", SWELL_NOW)).toBeNull();
    expect(await load({ snapshots: [] })).toBeNull();
    expect(await load({ snapshots: [swellSnapshot()], beach: null })).toBeNull();
  });

  it("throws on a database error so routes can answer with a real status", async () => {
    await expect(load({ snapshotError: "boom" })).rejects.toThrow("boom");
  });

  it.each([
    ["forecast", SWELL_NOW],
    ["arrived", new Date("2026-10-08T12:00:00.000Z")],
    ["passed", new Date("2026-10-10T00:00:00.000Z")],
  ])("resolves status %s", async (status, now) => {
    const detected = new Date(Math.min(now.getTime(), Date.parse("2026-10-08T14:30:00.000Z")) - 3_600_000).toISOString();
    const event = await load({ snapshots: [swellSnapshot({ detected_at: detected })] }, now);
    expect(event?.payload.status).toBe(status);
  });

  it("marks an event dropped when detection stopped well before the peak", async () => {
    const event = await load(
      { snapshots: [swellSnapshot({ run_date: "2026-10-01", detected_at: "2026-10-01T14:30:00.000Z" })] },
      new Date("2026-10-05T00:00:00.000Z"),
    );
    expect(event?.payload.status).toBe("dropped");
  });
});

describe("swell card view and history line", () => {
  it("uses only pool copy and stored numbers", async () => {
    const event = await load({ snapshots: [swellSnapshot()] });
    const view = buildSwellCardView({ event, kind: "arrived", titleId: "not-in-pool" });

    expect(view.generic).toBe(false);
    expect(view.serious).toBe(false);
    expect(view.headline).not.toContain("not-in-pool");
    expect(view.headline).not.toMatch(/[{}]/);
    expect(view.beachName).toBe("Trinidad State Beach");
    expect(view.stats).toEqual([
      { label: "Size", value: "6", unit: "ft" },
      { label: "Period", value: "14", unit: "s" },
      { label: "When", value: "Thu", unit: "Oct 8" },
    ]);
    // An unknown t falls back to a deterministic pool pick for the same event.
    const poolIds = poolFor("arrived").map(({ id }) => id);
    expect(poolIds).toContain(view.titleId);
    expect(buildSwellCardView({ event, kind: "arrived" })).toEqual(view);
  });

  it("honours a known title id on a non-serious swell", async () => {
    const event = await load({ snapshots: [swellSnapshot()] });
    const base = buildSwellCardView({ event, kind: "arrived" });
    const other = poolFor("arrived").find(
      (entry) => entry.id !== base.titleId && !entry.tags.includes("serious") && !/\{(?!beach\}|day\})/.test(entry.title),
    )!;
    const view = buildSwellCardView({ event, kind: "arrived", titleId: other.id });
    expect(view.titleId).toBe(other.id);
    expect(view.headline).not.toMatch(/[{}]/);
  });

  describe("serious swells", () => {
    it.each(["coming", "bigger", "smaller", "moved", "dropped", "arrived"] as const)(
      "never shows a joke title for %s, whatever t says",
      async (kind) => {
        const event = await load({ snapshots: [swellSnapshot({ peak_face_height_ft: 9.1 })] });
        const entries = poolFor(kind);
        const jokeIds = entries.filter((entry) => !entry.tags.includes("serious")).map(({ id }) => id);
        const seriousIds = entries.filter((entry) => entry.tags.includes("serious")).map(({ id }) => id);

        for (const titleId of [undefined, "not-in-pool", ...jokeIds]) {
          const view = buildSwellCardView({ event, kind, titleId });
          expect(view.serious).toBe(true);
          expect(seriousIds).toContain(view.titleId);
          expect(view.headline).not.toMatch(/[{}]/);
          expect(view.headline.length).toBeGreaterThan(0);
        }
      },
    );

    it("treats exactly 8 ft as serious and just under as not", async () => {
      const at = await load({ snapshots: [swellSnapshot({ peak_face_height_ft: 8 })] });
      const under = await load({ snapshots: [swellSnapshot({ peak_face_height_ft: 7.9 })] });
      expect(buildSwellCardView({ event: at, kind: "coming" }).serious).toBe(true);
      // 7.9 ft rounds to 7.9 and stays below the line.
      expect(buildSwellCardView({ event: under, kind: "coming" }).serious).toBe(false);
    });
  });

  it("never leaves a placeholder on the card, across kinds, severities and event keys", async () => {
    for (const faceHeight of [5, 10]) {
      const event = await load({ snapshots: [swellSnapshot({ peak_face_height_ft: faceHeight })] });
      for (const kind of ["coming", "bigger", "smaller", "moved", "dropped", "arrived"] as const) {
        for (let day = 1; day <= 28; day += 1) {
          const eventKey = `${SWELL_BEACH_ID}:NW:2026-10-${String(day).padStart(2, "0")}`;
          const view = buildSwellCardView({
            event: { ...event!, payload: { ...event!.payload, eventKey } },
            kind,
          });
          expect(view.headline).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it("drops {day} templates rather than rendering a hole when the peak date is unknown", async () => {
    const event = await load({ snapshots: [swellSnapshot()] });
    const noDay = { ...event!, payload: { ...event!.payload, peakLocalDate: null } };
    for (const kind of ["coming", "bigger", "smaller", "moved", "dropped", "arrived"] as const) {
      const view = buildSwellCardView({ event: noDay, kind });
      expect(view.headline).not.toMatch(/[{}]/);
      expect(view.headline.trim()).not.toBe("");
    }
  });

  it("returns a generic card without an event", () => {
    const view = buildSwellCardView({ event: null, kind: "dropped", titleId: "s35" });
    expect(view).toMatchObject({ generic: true, stats: [], titleId: null });
  });

  it("describes how the forecast moved", async () => {
    const moved = await load({
      snapshots: [
        swellSnapshot({ run_date: "2026-09-30", detected_at: "2026-09-30T14:30:00.000Z", peak_face_height_ft: 4, peak_at: "2026-10-07T15:00:00.000Z" }),
        swellSnapshot(),
      ],
    });
    expect(describeSwellHistory(moved!)).toBe(
      "Up from 4 ft to 6 ft since Wednesday, peak moved from Wednesday to Thursday.",
    );

    const fresh = await load({ snapshots: [swellSnapshot()] });
    expect(describeSwellHistory(fresh!)).toBe("New on the forecast as of Saturday. No revisions yet.");

    const passed = await load(
      { snapshots: [swellSnapshot({ run_date: "2026-10-07", detected_at: "2026-10-07T14:30:00.000Z" })] },
      new Date("2026-10-12T00:00:00.000Z"),
    );
    expect(describeSwellHistory(passed!)).toBe("This one has come and gone. It peaked Thursday at 6 ft.");

    const dropped = await load({ snapshots: [swellSnapshot()] }, new Date("2026-10-12T00:00:00.000Z"));
    expect(describeSwellHistory(dropped!)).toBe("This one fell off the forecast. The last read was 6 ft.");
  });
});

describe("buildSwellCard", () => {
  const KINDS = ["coming", "bigger", "smaller", "moved", "dropped", "arrived"] as const;

  it.each([
    ["ordinary", 5.6],
    ["serious", 9.1],
  ])("matches the card view for every kind and title id on a %s swell", async (_name, faceHeight) => {
    const event = await load({ snapshots: [swellSnapshot({ peak_face_height_ft: faceHeight })] });
    const rawTitleIds = [undefined, "not-in-pool", "fallback", "s33", "s42", "mv06", "b01", "s35"];
    for (const kind of KINDS) {
      for (const titleId of rawTitleIds) {
        const view = buildSwellCardView({ event, kind, titleId });
        const card = buildSwellCard({ event: event!, kind, titleId });
        expect(card).toEqual({
          kind,
          titleId: view.titleId,
          headline: view.headline,
          sizeFt: Math.round(faceHeight),
          periodS: 14,
          whenDayLabel: "Thu",
          whenDateLabel: "Oct 8",
          serious: view.serious,
        });
        // The drawn stats are the card's numbers, nothing else.
        expect(view.stats.map((stat) => stat.value)).toEqual([String(card.sizeFt), String(card.periodS), card.whenDayLabel]);
      }
    }
  });

  it("is the fix for 3.7 ft: the card rounds to whole feet and so does card.sizeFt", async () => {
    const event = await load({ snapshots: [swellSnapshot({ peak_face_height_ft: 3.7 })] });
    expect(event?.payload.faceHeightFt).toBe(3.7);
    expect(buildSwellCard({ event: event!, kind: "moved", titleId: "mv06" })).toMatchObject({
      sizeFt: 4,
      headline: "Move the fake dentist to Thursday.",
      titleId: "mv06",
    });
  });

  it("never puts the beach name in a first-alert headline without a title id", async () => {
    const event = await load({ snapshots: [swellSnapshot()] });
    for (let day = 1; day <= 28; day += 1) {
      const eventKey = `${SWELL_BEACH_ID}:NW:2026-10-${String(day).padStart(2, "0")}`;
      const card = buildSwellCard({
        event: { ...event!, payload: { ...event!.payload, eventKey } },
        kind: "coming",
      });
      expect(card.headline).not.toContain("Trinidad");
      expect(card.headline).not.toMatch(/[{}]/);
    }
  });

  it("uses null for values the stored snapshot lacks", async () => {
    const event = await load({ snapshots: [swellSnapshot()] });
    const bare = { ...event!, payload: { ...event!.payload, faceHeightFt: null, periodS: null, peakLocalDate: null } };
    expect(buildSwellCard({ event: bare, kind: "arrived" })).toMatchObject({
      sizeFt: null,
      periodS: null,
      whenDayLabel: null,
      whenDateLabel: null,
      serious: false,
    });
    expect(buildSwellCardView({ event: bare, kind: "arrived" }).stats.map((stat) => stat.value)).toEqual(["?", "?", "?"]);
  });
});

describe("describeSwellHistory size wording", () => {
  const run = (first: number, last: number) =>
    load({
      snapshots: [
        swellSnapshot({ run_date: "2026-10-02", detected_at: "2026-10-02T14:30:00.000Z", peak_face_height_ft: first }),
        swellSnapshot({ peak_face_height_ft: last }),
      ],
    });

  it.each([
    [3.3, 3.7, "Holding steady at 4 ft since Friday, peak still Thursday."],
    [3.7, 3.3, "Holding steady at 3 ft since Friday, peak still Thursday."],
    [4, 4, "Holding steady at 4 ft since Friday, peak still Thursday."],
    [3.3, 3.8, "Up from 3.3 ft to 3.8 ft since Friday, peak still Thursday."],
    [4.6, 4.2, "Holding steady at 4 ft since Friday, peak still Thursday."],
    [5, 4.4, "Down from 5 ft to 4.4 ft since Friday, peak still Thursday."],
    [3.4, 4.3, "Up from 3.4 ft to 4.3 ft since Friday, peak still Thursday."],
    [4, 6, "Up from 4 ft to 6 ft since Friday, peak still Thursday."],
    [7.4, 5.2, "Down from 7 ft to 5 ft since Friday, peak still Thursday."],
  ])("%s ft to %s ft", async (first, last, sentence) => {
    expect(describeSwellHistory((await run(first, last))!)).toBe(sentence);
  });
});
