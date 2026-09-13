import {
  recordSwellWatchProviderOutcome,
  validateSwellWatchReleaseAtDispatch,
} from "@/lib/notifications/worker";

const EVENT = {
  id: "00000000-0000-4000-8000-000000000004",
  type: "swell_watch",
  recipient_user_id: "00000000-0000-4000-8000-000000000001",
  payload: {
    type: "swell_watch",
    schema_version: "swell-watch-notification.v2",
    regional_event_id: "00000000-0000-4000-8000-000000000002",
    beach_id: "00000000-0000-4000-8000-000000000003",
    forecast_at: "2026-09-04T12:00:00.000Z",
    target_partition: { height_m: 1, period_s: 12, direction_deg: 180 },
  },
} as const;

describe("Swell Watch final release boundary", () => {
  it("fails closed before SQL when the static gate is absent", async () => {
    const rpc = jest.fn();
    delete process.env.SWELL_WATCH_PUSH_ENABLED;
    await expect(
      validateSwellWatchReleaseAtDispatch({ rpc } as never, EVENT as never),
    ).resolves.toEqual({ allowed: false, reasonCode: "static_disabled" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the service-only release RPC with the queued event identity", async () => {
    process.env.SWELL_WATCH_PUSH_ENABLED = "true";
    const rpc = jest.fn(async () => ({ data: [{ allowed: true, reason_code: "allowed" }], error: null }));
    await expect(
      validateSwellWatchReleaseAtDispatch({ rpc } as never, EVENT as never),
    ).resolves.toEqual({ allowed: true, reasonCode: "allowed" });
    expect(rpc).toHaveBeenCalledWith("swell_watch_validate_notification_release", {
      p_regional_event_id: EVENT.payload.regional_event_id,
      p_beach_id: EVENT.payload.beach_id,
      p_recipient_id: EVENT.recipient_user_id,
      p_forecast_at: EVENT.payload.forecast_at,
      p_notification_event_id: EVENT.id,
    });
  });

  it("binds only the exact queued notification event", async () => {
    process.env.SWELL_WATCH_PUSH_ENABLED = "true";
    const rpc = jest.fn(async () => ({ data: [{ allowed: false, reason_code: "notification_binding_mismatch" }], error: null }));

    await expect(
      validateSwellWatchReleaseAtDispatch({ rpc } as never, EVENT as never),
    ).resolves.toEqual({ allowed: false, reasonCode: "notification_binding_mismatch" });
    expect(rpc).toHaveBeenCalledWith("swell_watch_validate_notification_release", expect.objectContaining({
      p_notification_event_id: EVENT.id,
    }));
  });

  it("records bounded classified provider outcomes without tokens", async () => {
    const rpc = jest.fn(async (_name: string, _args: Record<string, unknown>) => ({ data: [], error: null }));
    await recordSwellWatchProviderOutcome({ rpc } as never, {
      id: EVENT.id,
      type: "swell_watch",
      attempt_count: 2,
    } as never, { samples: 3, failures: 1 });
    expect(rpc).toHaveBeenCalledWith("swell_watch_record_provider_delivery_outcome", {
      p_notification_event_id: EVENT.id,
      p_attempt_number: 2,
      p_sample_count: 3,
      p_failure_count: 1,
    });
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("token");
  });

  it.each([
    ["an error-shaped RPC response", jest.fn(async () => ({ error: { message: "hold persistence failed" } }))],
    ["a thrown RPC failure", jest.fn(async () => { throw new Error("hold persistence failed"); })],
  ])("surfaces %s instead of treating a failed durable hold as telemetry", async (_label, rpc) => {
    await expect(
      recordSwellWatchProviderOutcome({ rpc } as never, {
        id: EVENT.id,
        type: "swell_watch",
        attempt_count: 2,
      } as never, { samples: 3, failures: 1 }),
    ).rejects.toThrow("swell watch provider outcome persistence failed");
  });

  it("durably holds with the system actor before surfacing a monitor persistence failure", async () => {
    const rpc = jest.fn(async (name: string) => {
      if (name === "swell_watch_record_provider_delivery_outcome") {
        return { error: { message: "outcome write failed" } };
      }
      if (name === "swell_watch_get_automation_control") {
        return { data: [{ state: "armed", epoch: 8, reason_code: "operator_arm" }], error: null };
      }
      return { error: null };
    });
    await expect(
      recordSwellWatchProviderOutcome({ rpc } as never, {
        id: EVENT.id,
        type: "swell_watch",
        attempt_count: 2,
      } as never, { samples: 3, failures: 1 }),
    ).rejects.toThrow("swell watch provider outcome persistence failed");
    expect(rpc).toHaveBeenCalledWith("transition_swell_watch_automation_control", {
      p_operation: "hold",
      p_expected_epoch: 8,
      p_reason_code: "provider_outcome_persistence_failed",
      p_idempotency_key: `swell-watch-monitor-${EVENT.id}-2`,
      p_actor_user_id: null,
      p_system_actor: "swell_watch_provider_monitor",
    });
  });

  it.each([
    ["a held control", { data: [{ allowed: false, reason_code: "control_not_armed" }], error: null }, "control_not_armed"],
    ["an unavailable RPC", { data: null, error: { message: "unavailable" } }, "control_unavailable"],
  ])("fails closed for %s", async (_label, response, expected) => {
    process.env.SWELL_WATCH_PUSH_ENABLED = "true";
    await expect(
      validateSwellWatchReleaseAtDispatch({ rpc: jest.fn(async () => response) } as never, EVENT as never),
    ).resolves.toEqual({ allowed: false, reasonCode: expected });
  });

  it("never treats a raw v1 or malformed queued payload as releaseable", async () => {
    process.env.SWELL_WATCH_PUSH_ENABLED = "true";
    const rpc = jest.fn();
    await expect(
      validateSwellWatchReleaseAtDispatch({ rpc } as never, {
        ...EVENT,
        payload: { type: "swell_watch", beach_id: EVENT.payload.beach_id },
      } as never),
    ).resolves.toEqual({ allowed: false, reasonCode: "invalid_release_input" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
