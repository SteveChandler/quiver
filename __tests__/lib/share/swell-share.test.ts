/** @jest-environment node */
import {
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
import {
  fakeSwellSupabase,
  swellSnapshot,
  SWELL_BEACH_ID,
  SWELL_EVENT_KEY,
  SWELL_NOW,
} from "@/__tests__/helpers/swell-share-fixtures";

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
    expect(view.headline).not.toContain("not-in-pool");
    expect(view.beachName).toBe("Trinidad State Beach");
    expect(view.stats).toEqual([
      { label: "Size", value: "6", unit: "ft" },
      { label: "Period", value: "14", unit: "s" },
      { label: "When", value: "Thu", unit: "Oct 8" },
    ]);
    // Same event, same pick.
    expect(buildSwellCardView({ event, kind: "arrived" }).titleId).toBe(view.titleId);
  });

  it("gives serious swells plain copy", async () => {
    const event = await load({ snapshots: [swellSnapshot({ peak_face_height_ft: 9.1 })] });
    const view = buildSwellCardView({ event, kind: "coming" });
    expect(view.serious).toBe(true);
    expect(view.headline).toBe("Serious swell at Trinidad State Beach");
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
