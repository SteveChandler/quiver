/** @jest-environment node */

import { NextRequest } from "next/server";

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
const upsertSpy = jest.fn();
const insertSpy = jest.fn();
let upsertError: { message: string } | null = null;
let insertError: { message: string } | null = null;
let insertedImpressionKeys: Array<{ impression_key: string }> | null = [
  {
    impression_key:
      "user-1:beach:beach-1:2026-07-09T14:00:00.000Z:home_hero:2026-07-09T14:00:00.000Z",
  },
];

function buildSupabase() {
  return {
    from(table: string) {
      if (table === "recommendation_impressions") {
        return {
          upsert(payload: Record<string, unknown>[], options: Record<string, unknown>) {
            upsertSpy(payload, options);
            return {
              select(columns: string) {
                expect(columns).toBe("impression_key");
                return Promise.resolve({
                  data: insertedImpressionKeys,
                  error: upsertError,
                });
              },
            };
          },
        };
      }

      if (table === "user_events") {
        return {
          insert(payload: Record<string, unknown>[]) {
            insertSpy(payload);
            return Promise.resolve({ data: null, error: insertError });
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: (handler: any) => (request: NextRequest) =>
    handler(request, { user: mockUser, supabase: buildSupabase() }),
}));

import { POST } from "@/app/api/recommendation-impressions/route";

const payload = {
  impressions: [
    {
      recommendationId: "beach:beach-1:2026-07-09T14:00:00.000Z",
      beachId: "22222222-2222-4222-8222-222222222222",
      rank: 1,
      score: 88,
      windowStart: "2026-07-09T14:00:00.000Z",
      windowEnd: "2026-07-09T17:00:00.000Z",
      mode: "log",
      timeSlot: "dawn-patrol",
      surface: "home_hero",
    },
  ],
};

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/recommendation-impressions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("/api/recommendation-impressions", () => {
  beforeEach(() => {
    upsertSpy.mockClear();
    insertSpy.mockClear();
    upsertError = null;
    insertError = null;
    insertedImpressionKeys = [
      {
        impression_key:
          "user-1:beach:beach-1:2026-07-09T14:00:00.000Z:home_hero:2026-07-09T14:00:00.000Z",
      },
    ];
  });

  it("upserts impressions and emits matching user_events", async () => {
    const response = await POST(request(payload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: "user-1",
          recommendation_id: "beach:beach-1:2026-07-09T14:00:00.000Z",
          beach_id: "22222222-2222-4222-8222-222222222222",
          surface: "home_hero",
          impression_key:
            "user-1:beach:beach-1:2026-07-09T14:00:00.000Z:home_hero:2026-07-09T14:00:00.000Z",
        }),
      ],
      { onConflict: "impression_key", ignoreDuplicates: true }
    );
    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: "user-1",
        event_type: "recommendation_impression",
        beach_id: "22222222-2222-4222-8222-222222222222",
      }),
    ]);
  });

  it("rejects malformed payloads", async () => {
    const response = await POST(
      request({ impressions: [{ ...payload.impressions[0], rank: 0 }] })
    );

    expect(response.status).toBe(400);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("does not emit duplicate user_events when the impression already exists", async () => {
    insertedImpressionKeys = [];

    const response = await POST(request(payload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
