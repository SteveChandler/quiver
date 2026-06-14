/**
 * @jest-environment node
 *
 * Producer-level tests for processWaterQualityAlerts.
 *
 * Focus: the recipient pref gate. The water_quality registry entry now
 * delivers on push AND in_app, and the notifications-deliver worker applies
 * each channel's master pref per-channel. So the producer must gate ONLY on
 * the per-type opt-in (notif_water_quality) — it must NOT pre-exclude users
 * who have push off but in-app on, or they'd lose their inbox row.
 */

import { processWaterQualityAlerts } from "@/lib/services/water-quality/water-quality-alerts-service";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import type { SupabaseServiceClient } from "@/types/supabase";

jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: jest.fn(),
}));

const BEACH_ID = "beach-1";

type ProfileFixture = {
  id: string;
  home_beach_id: string | null;
  notif_water_quality: boolean;
  is_mock: boolean;
  timezone: string | null;
  // Present on the row but NOT selected/used by the producer anymore — kept
  // here only to prove the producer doesn't read it.
  notif_push_enabled?: boolean;
};

/**
 * Routes Supabase calls by table name. Each table resolves to its configured
 * `{ data, error }` regardless of which fluent chain (gt/neq/in/select) the
 * service uses, because every chain method returns the same thenable builder.
 */
function createServiceSupabaseMock(config: {
  beach_water_quality: { data: unknown; error?: unknown };
  beaches: { data: unknown; error?: unknown };
  profiles: { data: unknown; error?: unknown };
}) {
  const from = jest.fn((table: string) => {
    const source = config[table as keyof typeof config];
    const resolve = () =>
      Promise.resolve({
        data: source?.data ?? null,
        error: source?.error ?? null,
      });

    const builder: Record<string, unknown> = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      gt: jest.fn(() => builder),
      neq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => resolve().then(onFulfilled, onRejected),
    };
    return builder;
  });

  return { from } as unknown as SupabaseServiceClient;
}

function profile(overrides: Partial<ProfileFixture>): ProfileFixture {
  return {
    id: "user-1",
    home_beach_id: BEACH_ID,
    notif_water_quality: true,
    is_mock: false,
    timezone: "America/Los_Angeles",
    ...overrides,
  };
}

describe("processWaterQualityAlerts — recipient pref gate", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    (enqueueNotification as jest.Mock).mockResolvedValue({
      enqueued: true,
      eventId: "evt-1",
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const changedBeach = {
    id: "wq-1",
    beach_id: BEACH_ID,
    status: "advisory",
    previous_status: "good",
    status_changed_at: "2026-06-13T12:00:00.000Z",
  };
  const beachRow = { id: BEACH_ID, slug: "ocean-beach", name: "Ocean Beach" };

  it("enqueues a user with push OFF but in-app ON (the pref-gate bug fix)", async () => {
    const supabase = createServiceSupabaseMock({
      beach_water_quality: { data: [changedBeach] },
      beaches: { data: [beachRow] },
      profiles: {
        data: [profile({ id: "push-off", notif_push_enabled: false })],
      },
    });

    const result = await processWaterQualityAlerts(supabase);

    expect(enqueueNotification).toHaveBeenCalledTimes(1);
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "water_quality",
        recipientUserId: "push-off",
      })
    );
    expect(result.notificationsSent).toBe(1);
  });

  it("excludes a user who opted out of the water-quality type", async () => {
    const supabase = createServiceSupabaseMock({
      beach_water_quality: { data: [changedBeach] },
      beaches: { data: [beachRow] },
      profiles: {
        data: [profile({ id: "wq-off", notif_water_quality: false })],
      },
    });

    const result = await processWaterQualityAlerts(supabase);

    expect(enqueueNotification).not.toHaveBeenCalled();
    expect(result.notificationsSent).toBe(0);
  });

  it("excludes mock users", async () => {
    const supabase = createServiceSupabaseMock({
      beach_water_quality: { data: [changedBeach] },
      beaches: { data: [beachRow] },
      profiles: { data: [profile({ id: "mock", is_mock: true })] },
    });

    const result = await processWaterQualityAlerts(supabase);

    expect(enqueueNotification).not.toHaveBeenCalled();
    expect(result.notificationsSent).toBe(0);
  });

  it("does not enqueue for a no-op 'good' transition with no prior advisory/closure", async () => {
    const supabase = createServiceSupabaseMock({
      beach_water_quality: {
        data: [{ ...changedBeach, status: "good", previous_status: "good" }],
      },
      beaches: { data: [beachRow] },
      profiles: { data: [profile({ id: "user-1" })] },
    });

    const result = await processWaterQualityAlerts(supabase);

    expect(enqueueNotification).not.toHaveBeenCalled();
    expect(result.notificationsSkipped).toBe(1);
  });

  it("enqueues a recovery alert when status returns to good from a closure", async () => {
    const supabase = createServiceSupabaseMock({
      beach_water_quality: {
        data: [{ ...changedBeach, status: "good", previous_status: "closure" }],
      },
      beaches: { data: [beachRow] },
      profiles: { data: [profile({ id: "user-1" })] },
    });

    const result = await processWaterQualityAlerts(supabase);

    expect(enqueueNotification).toHaveBeenCalledTimes(1);
    expect(result.notificationsSent).toBe(1);
  });
});
