/** @jest-environment node */

import { POST } from "@/app/api/alerts/attribution/route";
import { getOwnAnalyticsTrackingAllowed } from "@/lib/analytics/consent";
import type { NextRequest } from "next/server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const PUSH_ID = "33333333-3333-4333-8333-333333333333";
const EMAIL_ID = "44444444-4444-4444-8444-444444444444";
const FALLBACK_EMAIL_ID = "55555555-5555-4555-8555-555555555555";
const UNKNOWN_ID = "66666666-6666-4666-8666-666666666666";
const BEACH_ID = "77777777-7777-4777-8777-777777777777";

const notificationRows: Array<Record<string, unknown>> = [];
const emailRows: Array<Record<string, unknown>> = [];
const attemptRows: Array<Record<string, unknown>> = [];
const persistedEventKeys = new Set<string>();
const mockInsert = jest.fn(async (row: Record<string, any>) => {
  const key = [
    row.user_id,
    row.event_type,
    row.metadata.message_instance_id,
    row.metadata.action ?? "",
  ].join(":");
  if (persistedEventKeys.has(key)) {
    return { error: { code: "23505", message: "duplicate key" } };
  }
  persistedEventKeys.add(key);
  return { error: null };
});

function query(rows: Array<Record<string, unknown>>) {
  const filters = new Map<string, unknown>();
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn((column: string, value: unknown) => {
      filters.set(column, value);
      return chain;
    }),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({
      data: rows.find((row) =>
        [...filters].every(([column, value]) => row[column] === value),
      ) ?? null,
      error: null,
    })),
  };
  return chain;
}

const mockServiceClient = {
  from: jest.fn((table: string) => {
    if (table === "notification_events") return query(notificationRows);
    if (table === "email_send_log") return query(emailRows);
    if (table === "alert_delivery_attempts") return query(attemptRows);
    throw new Error(`Unexpected table: ${table}`);
  }),
};
const mockUserClient = {
  from: jest.fn((table: string) => {
    if (table === "user_events") return { insert: mockInsert };
    throw new Error(`Unexpected user table: ${table}`);
  }),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => mockServiceClient),
}));

jest.mock("@/lib/analytics/consent", () => ({
  getOwnAnalyticsTrackingAllowed: jest.fn(async () => true),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createErrorResponse: jest.fn((error: string, _details?: unknown, status = 500) =>
    Response.json({ success: false, error }, { status }),
  ),
  createSuccessResponse: jest.fn((data: unknown) =>
    Response.json({ success: true, data }),
  ),
  withProtection: jest.fn((handler) => (request: Request) => handler(request, {
    user: { id: USER_ID },
    supabase: mockUserClient,
  })),
  withNoStore: jest.fn((handler) => handler),
}));

function request(body: Record<string, unknown>): NextRequest {
  return new Request("http://localhost/api/alerts/attribution", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function attributionBody(overrides: Record<string, unknown> = {}) {
  return {
    message_instance_id: PUSH_ID,
    delivery_channel: "push",
    stage: "message_activated",
    ...overrides,
  };
}

describe("POST /api/alerts/attribution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    persistedEventKeys.clear();
    notificationRows.splice(0, notificationRows.length, {
      id: PUSH_ID,
      recipient_user_id: USER_ID,
      type: "forecast_alert",
      entity_type: "beach",
      entity_id: BEACH_ID,
    });
    emailRows.splice(0, emailRows.length, {
      message_instance_id: EMAIL_ID,
      user_id: USER_ID,
      email_type: "conditions_alert",
      best_beach_id: BEACH_ID,
    });
    attemptRows.splice(0, attemptRows.length,
      { message_instance_id: PUSH_ID, user_id: USER_ID, channel: "push", status: "sent" },
      { message_instance_id: EMAIL_ID, user_id: USER_ID, channel: "email", status: "sent" },
      { message_instance_id: FALLBACK_EMAIL_ID, user_id: USER_ID, channel: "email", status: "sent" },
    );
    jest.mocked(getOwnAnalyticsTrackingAllowed).mockResolvedValue(true);
  });

  it("writes a derived event only for the stored recipient", async () => {
    const response = await POST(request(attributionBody({
      stage: "decision_action",
      action: "watch_call",
      user_id: OTHER_USER_ID,
      notification_type: "admin_broadcast",
    })));

    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: USER_ID,
      event_type: "alert_decision_action",
      beach_id: BEACH_ID,
      metadata: {
        message_instance_id: PUSH_ID,
        delivery_channel: "push",
        notification_type: "forecast_alert",
        action: "watch_call",
      },
    });
  });

  it("attributes an owned delivered email", async () => {
    await POST(request(attributionBody({
      message_instance_id: EMAIL_ID,
      delivery_channel: "email",
    })));

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      beach_id: BEACH_ID,
      metadata: expect.objectContaining({
        delivery_channel: "email",
        notification_type: "conditions_alert",
      }),
    }));
  });

  it("falls back to a sent email attempt when the send log is absent", async () => {
    await POST(request(attributionBody({
      message_instance_id: FALLBACK_EMAIL_ID,
      delivery_channel: "email",
    })));

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      beach_id: null,
      metadata: expect.objectContaining({
        notification_type: "conditions_alert",
      }),
    }));
  });

  it.each([
    ["push", "failed_provider"],
    ["push", "skipped_no_device"],
    ["email", "failed_provider"],
    ["email", "skipped_channel_disabled"],
  ])("acknowledges a %s %s attempt without writing", async (channel, status) => {
    const messageId = channel === "push" ? PUSH_ID : EMAIL_ID;
    const attempt = attemptRows.find((row) =>
      row.message_instance_id === messageId && row.channel === channel,
    );
    if (attempt) attempt.status = status;

    const response = await POST(request(attributionBody({
      message_instance_id: messageId,
      delivery_channel: channel,
    })));

    expect(response.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it.each([
    ["message_activated", "alert_message_activated"],
    ["app_returned", "alert_app_returned"],
    ["return_to_decision", "alert_return_to_decision"],
  ])("maps %s to its distinct event", async (stage, eventType) => {
    await POST(request(attributionBody({ stage })));

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: eventType,
    }));
  });

  it.each([
    ["wrong recipient", { message_instance_id: EMAIL_ID, delivery_channel: "email", stage: "message_activated" }],
    ["forwarded link", { message_instance_id: EMAIL_ID, delivery_channel: "email", stage: "app_returned", user_id: USER_ID }],
    ["malformed UUID", { message_instance_id: "not-a-uuid", delivery_channel: "push", stage: "message_activated" }],
    ["wrong channel", { message_instance_id: PUSH_ID, delivery_channel: "email", stage: "message_activated" }],
    ["missing message", { message_instance_id: UNKNOWN_ID, delivery_channel: "push", stage: "message_activated" }],
  ])("acknowledges %s without writing", async (name, body) => {
    if (name === "wrong recipient" || name === "forwarded link") {
      attemptRows[1].user_id = OTHER_USER_ID;
      emailRows[0].user_id = OTHER_USER_ID;
    }
    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("acknowledges analytics opt-out without writing", async () => {
    jest.mocked(getOwnAnalyticsTrackingAllowed).mockResolvedValue(false);

    const response = await POST(request(attributionBody()));

    expect(response.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockServiceClient.from).not.toHaveBeenCalled();
  });

  it("acknowledges an identical replay without persisting another event", async () => {
    const body = attributionBody({ stage: "decision_action", action: "watch_call" });

    const first = await POST(request(body));
    const replay = await POST(request(body));

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(persistedEventKeys.size).toBe(1);
  });

  it("returns equivalent acknowledgements for known and unknown messages", async () => {
    const known = await POST(request(attributionBody()));
    const unknown = await POST(request(attributionBody({ message_instance_id: UNKNOWN_ID })));

    expect({ status: unknown.status, body: await unknown.text() }).toEqual({
      status: known.status,
      body: await known.text(),
    });
  });

  it("rejects an unbounded action before ownership lookup", async () => {
    const response = await POST(request(attributionBody({
      stage: "decision_action",
      action: "delete_account",
    })));

    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
