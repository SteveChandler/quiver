/** @jest-environment node */
import { NextRequest } from "next/server";

import {
  fakeSwellSupabase,
  swellSnapshot,
  SWELL_EVENT_KEY,
} from "@/__tests__/helpers/swell-share-fixtures";

let mockDb: Parameters<typeof fakeSwellSupabase>[0] = {};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () =>
    jest.requireActual("@/__tests__/helpers/swell-share-fixtures").fakeSwellSupabase(mockDb),
}));
jest.mock("@/lib/middleware/api-wrappers", () => {
  const protectionOptions: unknown[] = [];
  return {
    protectionOptions,
    withProtection: (handler: unknown, options: unknown) => {
      protectionOptions.push(options);
      return handler;
    },
  };
});

const mockRecordOpen = jest.fn<Promise<void>, unknown[]>(async () => {});
jest.mock("@/lib/alerts/swell-outlook/state", () => ({
  recordSwellOpen: (...args: unknown[]) => mockRecordOpen(...args),
}));

const mockAfterTasks: Array<() => Promise<void>> = [];
jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: (task: () => Promise<void>): void => { mockAfterTasks.push(task); },
}));

async function finishBookkeeping(): Promise<void> {
  for (const task of mockAfterTasks.splice(0)) await task();
}

import { GET } from "@/app/api/swell/[eventKey]/route";

function call(eventKey: string, query = "", user?: { id: string }): Promise<Response> {
  return GET(
    new NextRequest(`https://www.quiversurf.app/api/swell/${encodeURIComponent(eventKey)}${query}`),
    { params: Promise.resolve({ eventKey: encodeURIComponent(eventKey) }), ...(user ? { user } : {}) } as never,
  );
}

describe("GET /api/swell/[eventKey]", () => {
  beforeEach(() => {
    mockAfterTasks.length = 0;
    mockRecordOpen.mockReset();
    mockRecordOpen.mockResolvedValue(undefined);
    mockDb = { snapshots: [swellSnapshot()] };
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("is public with optional auth and rate limited", () => {
    expect(jest.requireMock("@/lib/middleware/api-wrappers").protectionOptions[0]).toEqual({
      auth: { required: false },
      rateLimit: { key: "public-default" },
    });
  });

  it("returns the event with a short shared cache", async () => {
    const response = await call(SWELL_EVENT_KEY);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(
      ["beach", "card", "directionLabel", "eventKey", "faceHeightFt", "history", "peakAt", "peakLocalDate", "periodS", "status"],
    );
    expect(body.eventKey).toBe(SWELL_EVENT_KEY);
    expect(body.history).toHaveLength(1);
    // Existing fields stay raw: the card carries the rounded, displayed values.
    expect(body.faceHeightFt).toBe(5.6);
    expect(Object.keys(body.card)).toEqual(
      ["kind", "titleId", "headline", "sizeFt", "periodS", "whenDayLabel", "whenDateLabel", "serious"],
    );
    expect(body.card).toMatchObject({
      kind: "coming",
      sizeFt: 6,
      periodS: 14,
      whenDayLabel: "Thu",
      whenDateLabel: "Oct 8",
      serious: false,
    });
    expect(body.card.headline).not.toContain("Trinidad");
  });

  it("builds the card from k and t, validated like the image route", async () => {
    const moved = await (await call(SWELL_EVENT_KEY, "?k=moved&t=mv06")).json();
    expect(moved.card).toMatchObject({
      kind: "moved",
      titleId: "mv06",
      headline: "Move the fake dentist to Thursday.",
    });

    const unknown = await (await call(SWELL_EVENT_KEY, "?k=<script>&t=not%20an%20id")).json();
    const plain = await (await call(SWELL_EVENT_KEY)).json();
    expect(unknown.card).toEqual(plain.card);
    expect(unknown.card.kind).toBe("coming");

    const invalidTitle = await (await call(SWELL_EVENT_KEY, "?k=bigger&t=zzz")).json();
    expect(invalidTitle.card.kind).toBe("bigger");
    expect(invalidTitle.card.titleId).not.toBe("zzz");
  });

  it("agrees with the page and image view for the same event, kind and title", async () => {
    const { buildSwellCardView, loadSwellShareEvent } = jest.requireActual("@/lib/share/swell-share");
    const { fakeSwellSupabase } = jest.requireActual("@/__tests__/helpers/swell-share-fixtures");
    const event = await loadSwellShareEvent(fakeSwellSupabase(mockDb), SWELL_EVENT_KEY);
    for (const [query, kind, titleId] of [
      ["", "coming", undefined],
      ["?k=arrived&t=ar01", "arrived", "ar01"],
      ["?k=dropped&t=bogus!", "dropped", undefined],
    ] as const) {
      const { card } = await (await call(SWELL_EVENT_KEY, query)).json();
      const view = buildSwellCardView({ event, kind, titleId });
      expect([card.kind, card.titleId, card.headline]).toEqual([view.kind, view.titleId, view.headline]);
    }
  });

  it("answers a serious swell with serious copy and the serious flag", async () => {
    mockDb = { snapshots: [swellSnapshot({ peak_face_height_ft: 9.1 })] };
    const { card } = await (await call(SWELL_EVENT_KEY, "?k=bigger&t=b01")).json();
    expect(card.serious).toBe(true);
    expect(card.titleId).not.toBe("b01");
  });

  it("resolves an uppercase uuid and answers with the stored lowercase key", async () => {
    const response = await call(SWELL_EVENT_KEY.toUpperCase());
    expect(response.status).toBe(200);
    expect((await response.json()).eventKey).toBe(SWELL_EVENT_KEY);
  });

  it("returns 404 not_found for an unknown event", async () => {
    mockDb = { snapshots: [] };
    const response = await call(SWELL_EVENT_KEY);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("returns 400 for a malformed key without touching the database", async () => {
    mockDb = { snapshotError: "should not be read" };
    const response = await call("1 OR 1=1");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_event_key" });
  });

  it("returns 500 rather than a 200 when the read fails", async () => {
    mockDb = { snapshotError: "boom" };
    const response = await call(SWELL_EVENT_KEY);
    expect(response.status).toBe(500);
  });

  it("records a signed-in read as an answer, and an anonymous one not at all", async () => {
    expect((await call(SWELL_EVENT_KEY, "", { id: "user-9" })).status).toBe(200);
    await finishBookkeeping();
    expect(mockRecordOpen).toHaveBeenCalledWith(expect.anything(), "user-9", expect.any(Date));
    mockRecordOpen.mockClear();
    await call(SWELL_EVENT_KEY);
    await finishBookkeeping();
    expect(mockRecordOpen).not.toHaveBeenCalled();
  });

  it("never fails the response when recording the open fails", async () => {
    mockRecordOpen.mockRejectedValueOnce(new Error("db down"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    expect((await call(SWELL_EVENT_KEY, "", { id: "user-9" })).status).toBe(200);
    await finishBookkeeping();
    expect(console.warn).toHaveBeenCalledWith("[api/swell] Failed to record swell open:", expect.any(Error));
  });

  it("does not record an open for a malformed key", async () => {
    mockRecordOpen.mockClear();
    expect((await call("1 OR 1=1", "", { id: "user-9" })).status).toBe(400);
    expect(mockRecordOpen).not.toHaveBeenCalled();
    expect(mockAfterTasks).toEqual([]);
  });

  it("keeps the public body and cache headers while open recording is pending", async () => {
    const anonymous = await call(SWELL_EVENT_KEY);
    let finish: () => void = (): void => { throw new Error("Open recording did not start"); };
    mockRecordOpen.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const signedIn = await call(SWELL_EVENT_KEY, "", { id: "user-9" });
    expect(signedIn.status).toBe(200);
    expect(await signedIn.json()).toEqual(await anonymous.json());
    expect(signedIn.headers.get("Cache-Control")).toBe(anonymous.headers.get("Cache-Control"));
    expect(mockAfterTasks).toHaveLength(1);
    const bookkeeping = finishBookkeeping();
    expect(mockRecordOpen).toHaveBeenCalledTimes(1);
    finish();
    await bookkeeping;
  });

  it("also isolates a profile-deletion foreign-key error", async () => {
    mockRecordOpen.mockRejectedValueOnce(Object.assign(new Error("foreign key violation"), { code: "23503" }));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const response = await call(SWELL_EVENT_KEY, "", { id: "deleted-user" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    await finishBookkeeping();
    expect(console.warn).toHaveBeenCalled();
  });

});
