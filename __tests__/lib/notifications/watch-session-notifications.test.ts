/** @jest-environment node */
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

describe("watch session notifications", () => {
  it("validates and builds a ready push with singular and plural waves", () => {
    const def = NOTIFICATION_REGISTRY.watch_session_ready;
    expect(def.channels).toEqual(["push"]);
    expect(def.prefs).toEqual({ master: { push: "notif_push_enabled" }, perType: {} });
    expect(def.quietHours).toEqual({ mode: "defer", windowStart: 22, windowEnd: 4 });
    expect(() => def.validatePayload!({ session_id: "session-1", beach_name: "", wave_count: -1 })).toThrow();
    const singular = def.validatePayload!({ session_id: "session-1", beach_name: "Scripps", wave_count: 1 });
    expect(def.buildPushPayload!(singular)).toEqual({
      title: "Your surf is in Quiver", body: "Scripps: 1 wave",
      data: { type: "watch_session_ready", session_id: "session-1" },
    });
    const plural = def.validatePayload!({ session_id: "session-2", beach_name: "Scripps", wave_count: 3 });
    expect(def.buildPushPayload!(plural).body).toBe("Scripps: 3 waves");
  });

  it("validates and builds a needs-beach push in the surf timezone", () => {
    const def = NOTIFICATION_REGISTRY.watch_session_needs_beach;
    expect(def.channels).toEqual(["push"]);
    expect(def.prefs).toEqual({ master: { push: "notif_push_enabled" }, perType: {} });
    expect(def.quietHours).toEqual({ mode: "defer", windowStart: 22, windowEnd: 4 });
    expect(() => def.validatePayload!({ import_id: "import-1", started_at: "bad" })).toThrow();
    const payload = def.validatePayload!({
      import_id: "import-1", started_at: "2026-10-19T02:00:00Z", timezone: "America/Los_Angeles",
    });
    expect(def.buildPushPayload!(payload)).toEqual({
      title: "Pick the beach for your surf",
      body: "Your Oct 18 surf needs a beach before it can be saved",
      data: { type: "watch_session_needs_beach", import_id: "import-1" },
    });
    const fallback = def.validatePayload!({ import_id: "import-2", started_at: "2026-10-19T02:00:00Z" });
    expect(def.buildPushPayload!(fallback).body).toBe("Your Oct 19 surf needs a beach before it can be saved");
  });
});
