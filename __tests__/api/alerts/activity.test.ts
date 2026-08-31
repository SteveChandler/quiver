/** @jest-environment node */

import { NextRequest } from "next/server";

// NextResponse.json polyfill — jsdom doesn't ship Response.json().
if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
}

const mockUser = { id: "user-1" };

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockGte = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockFrom = jest.fn();

let notificationRows: unknown[] = [];
let queryError: { message: string } | null = null;

function buildChain() {
  const chain: any = {};
  chain.select = mockSelect.mockImplementation(() => chain);
  chain.eq = mockEq.mockImplementation(() => chain);
  chain.in = mockIn.mockImplementation(() => chain);
  chain.gte = mockGte.mockImplementation(() => chain);
  chain.order = mockOrder.mockImplementation(() => chain);
  chain.limit = mockLimit.mockImplementation(() =>
    Object.assign(
      Promise.resolve({ data: notificationRows, error: queryError }),
      chain,
    ),
  );
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: notificationRows, error: queryError }).then(
      resolve,
    );
  return chain;
}

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth:
      (handler: any) =>
      (request: Request) =>
        handler(request, {
          user: mockUser,
          supabase: { from: mockFrom },
        }),
  };
});

import { GET } from "@/app/api/alerts/activity/route";

describe("GET /api/alerts/activity", () => {
  const nowMs = Date.parse("2026-05-26T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(nowMs);
    notificationRows = [];
    queryError = null;
    mockFrom.mockReturnValue(buildChain());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads recent alert notifications with a clamped 7-day window", async () => {
    notificationRows = [
      {
        id: "notif-similarity",
        type: "similarity_match",
        created_at: "2026-05-26T06:00:00.000Z",
        read_at: null,
        data: {
          beach_id: "beach-1",
          beach_slug: "swamis",
          beach_name: "Swamis",
          alert_date: "2026-05-26",
          forecast_at: "2026-05-26T14:00:00.000Z",
          window_start: "2026-05-26T14:00:00.000Z",
          window_end: null,
          score: 8.6,
          label: "Excellent",
          reason: "Clean waist-high window matched your best sessions.",
          window_local: "7-9 AM",
          condition_summary: "2-3 ft, light offshore wind",
        },
      },
    ];

    const res = await GET(
      new NextRequest("http://localhost:3000/api/alerts/activity?days=99"),
    );

    expect(res.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("notifications");
    expect(mockSelect).toHaveBeenCalledWith(
      "id, type, data, read_at, created_at",
    );
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockIn).toHaveBeenCalledWith("type", [
      "forecast_alert",
      "similarity_match",
      "swell_watch",
      "watched_call_update",
    ]);
    expect(mockGte).toHaveBeenCalledWith(
      "created_at",
      "2026-05-19T12:00:00.000Z",
    );
    expect(mockOrder).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(mockLimit).toHaveBeenCalledWith(100);

    const body = await res.json();
    expect(body.data).toMatchObject({
      days: 7,
      activity: [
        {
          id: "notif-similarity",
          type: "similarity_match",
          beach_id: "beach-1",
          beach_slug: "swamis",
          beach_name: "Swamis",
          forecast_at: "2026-05-26T14:00:00.000Z",
          window_start: "2026-05-26T14:00:00.000Z",
          window_end: null,
          score: 8.6,
          title: "Excellent match at Swamis",
          body: "Clean waist-high window matched your best sessions.",
          reason: "Clean waist-high window matched your best sessions.",
          window_label: "7-9 AM",
          read_at: null,
          created_at: "2026-05-26T06:00:00.000Z",
        },
      ],
    });
    expect(body.data.activity[0]).not.toHaveProperty("data");
  });

  it("normalizes bounded watched-call history context", async () => {
    notificationRows = [{
      id: "notif-watched",
      type: "watched_call_update",
      created_at: "2026-08-25T12:00:00.000Z",
      read_at: null,
      data: {
        category: "call_changed",
        cause: "forecast_materially_changed",
        alert_rule_id: "rule-1",
        beach_id: "beach-1",
        beach_name: "Swamis",
        recommendation_id: "recommendation-2",
        prior_recommendation_id: "recommendation-1",
        window_start: "2026-08-25T17:00:00.000Z",
        window_end: "2026-08-25T19:00:00.000Z",
        forecast_at: "2026-08-25T18:00:00.000Z",
        title: "Call changed at Swamis",
        body: "The stronger window moved later.",
      },
    }];

    const res = await GET(new NextRequest("http://localhost:3000/api/alerts/activity?days=7"));
    const body = await res.json();
    expect(body.data.activity[0]).toMatchObject({
      type: "watched_call_update",
      category: "call_changed",
      cause: "forecast_materially_changed",
      alert_rule_id: "rule-1",
      recommendation_id: "recommendation-2",
      prior_recommendation_id: "recommendation-1",
      beach_id: "beach-1",
      window_start: "2026-08-25T17:00:00.000Z",
      window_end: "2026-08-25T19:00:00.000Z",
    });
    expect(JSON.stringify(body.data.activity[0])).not.toMatch(/evidence|latitude|longitude|notes/i);
  });

  it("normalizes forecast alert context from the in-app payload", async () => {
    notificationRows = [
      {
        id: "notif-forecast",
        type: "forecast_alert",
        created_at: "2026-05-26T05:00:00.000Z",
        read_at: "2026-05-26T05:30:00.000Z",
        data: {
          alert_date: "2026-05-26",
          title: "Small clean longboard waves",
          body: "Bolsa Chica around 7 AM.",
          beach_id: "beach-2",
          beach_slug: "bolsa-chica",
          forecast_at: "2026-05-26T14:00:00.000Z",
          matches: [
            {
              beach_name: "Bolsa Chica",
              window_start: "2026-05-26T13:30:00.000Z",
              window_end: "2026-05-26T15:30:00.000Z",
            },
          ],
        },
      },
    ];

    const res = await GET(
      new NextRequest("http://localhost:3000/api/alerts/activity?days=3"),
    );

    expect(res.status).toBe(200);
    expect(mockGte).toHaveBeenCalledWith(
      "created_at",
      "2026-05-23T12:00:00.000Z",
    );
    const body = await res.json();
    expect(body.data).toMatchObject({
      days: 3,
      activity: [
        {
          id: "notif-forecast",
          type: "forecast_alert",
          beach_id: "beach-2",
          beach_slug: "bolsa-chica",
          beach_name: "Bolsa Chica",
          forecast_at: "2026-05-26T14:00:00.000Z",
          window_start: "2026-05-26T13:30:00.000Z",
          window_end: "2026-05-26T15:30:00.000Z",
          title: "Small clean longboard waves",
          body: "Bolsa Chica around 7 AM.",
          read_at: "2026-05-26T05:30:00.000Z",
        },
      ],
    });
    expect(body.data.activity[0]).not.toHaveProperty("matches");
  });

  it("normalizes forecast alert context from the canonical session decision", async () => {
    notificationRows = [
      {
        id: "notif-canonical-forecast",
        type: "forecast_alert",
        created_at: "2026-05-26T05:00:00.000Z",
        read_at: null,
        data: {
          alert_date: "2026-05-26",
          title: "Go Bolsa Chica",
          body: "Best window is 6:30-8:30 AM.",
          beach_id: "beach-2",
          beach_slug: "bolsa-chica",
          forecast_at: "2026-05-26T14:00:00.000Z",
          session_decision: {
            verdict: "go",
            selection: {
              beachId: "beach-2",
              beachName: "Bolsa Chica",
              windowStart: "2026-05-26T13:30:00.000Z",
              windowEnd: "2026-05-26T15:30:00.000Z",
              forecastRef: {
                forecastAt: "2026-05-26T14:00:00.000Z",
              },
            },
          },
        },
      },
    ];

    const res = await GET(
      new NextRequest("http://localhost:3000/api/alerts/activity?days=3"),
    );
    const body = await res.json();

    expect(body.data.activity[0]).toMatchObject({
      beach_id: "beach-2",
      beach_name: "Bolsa Chica",
      forecast_at: "2026-05-26T14:00:00.000Z",
      window_start: "2026-05-26T13:30:00.000Z",
      window_end: "2026-05-26T15:30:00.000Z",
    });
  });

  it("prefers canonical selection context over mismatched top-level and legacy values", async () => {
    notificationRows = [
      {
        id: "notif-canonical-mismatch",
        type: "similarity_match",
        created_at: "2026-05-26T05:00:00.000Z",
        read_at: null,
        data: {
          title: "Go canonical",
          body: "Use the canonical window.",
          beach_id: "top-level-beach",
          beach_name: "Top-Level Beach",
          forecast_at: "2026-05-26T10:00:00.000Z",
          matches: [
            {
              beach_id: "legacy-beach",
              beach_name: "Legacy Beach",
              forecast_at: "2026-05-26T11:00:00.000Z",
              window_start: "2026-05-26T11:00:00.000Z",
              window_end: "2026-05-26T12:00:00.000Z",
            },
          ],
          session_decision: {
            verdict: "go",
            selection: {
              beachId: "canonical-beach",
              beachName: "Canonical Beach",
              windowStart: "2026-05-26T13:30:00.000Z",
              windowEnd: "2026-05-26T15:30:00.000Z",
              forecastRef: {
                forecastAt: "2026-05-26T14:00:00.000Z",
              },
            },
          },
        },
      },
    ];

    const res = await GET(
      new NextRequest("http://localhost:3000/api/alerts/activity?days=3"),
    );
    const body = await res.json();

    expect(body.data.activity[0]).toMatchObject({
      beach_id: "canonical-beach",
      beach_name: "Canonical Beach",
      forecast_at: "2026-05-26T14:00:00.000Z",
      window_start: "2026-05-26T13:30:00.000Z",
      window_end: "2026-05-26T15:30:00.000Z",
    });
  });

  it("does not revive positive context after an explicit canonical no decision", async () => {
    notificationRows = [
      {
        id: "notif-canonical-no",
        type: "forecast_alert",
        created_at: "2026-05-26T05:00:00.000Z",
        read_at: null,
        data: {
          title: "No worthwhile window",
          body: "Conditions do not clear the bar.",
          beach_id: "top-level-beach",
          beach_slug: "top-level-beach",
          beach_name: "Top-Level Beach",
          forecast_at: "2026-05-26T10:00:00.000Z",
          score: 9,
          window_label: "6-8 AM",
          reason: "Top-level positive reason.",
          matches: [
            {
              beach_id: "legacy-beach",
              beach_name: "Legacy Beach",
              forecast_at: "2026-05-26T11:00:00.000Z",
              window_start: "2026-05-26T11:00:00.000Z",
              window_end: "2026-05-26T12:00:00.000Z",
            },
          ],
          session_decision: {
            verdict: "no",
            selection: null,
          },
        },
      },
    ];

    const res = await GET(
      new NextRequest("http://localhost:3000/api/alerts/activity?days=3"),
    );
    const body = await res.json();

    expect(body.data.activity[0]).toMatchObject({
      beach_id: null,
      beach_slug: null,
      beach_name: null,
      forecast_at: null,
      window_start: null,
      window_end: null,
      window_label: null,
      score: null,
      reason: null,
    });
  });
});
