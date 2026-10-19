/** @jest-environment node */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
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
      data: { type: "watch_session_ready", session_id: "session-1", url: "/sessions/session-1", deeplink: "quiver://sessions/session-1" },
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
      data: { type: "watch_session_needs_beach", import_id: "import-1", url: "/sessions/imports/import-1", deeplink: "quiver://sessions/imports/import-1" },
    });
    const fallback = def.validatePayload!({ import_id: "import-2", started_at: "2026-10-19T02:00:00Z" });
    expect(def.buildPushPayload!(fallback).body).toBe("Your Oct 19 surf needs a beach before it can be saved");
  });

  it.each([
    { label: "extra keys", payload: { session_id: "session-1", beach_name: "Scripps", wave_count: 2, extra: true } },
    { label: "fractional wave count", payload: { session_id: "session-1", beach_name: "Scripps", wave_count: 1.5 } },
    { label: "blank beach name", payload: { session_id: "session-1", beach_name: "   ", wave_count: 2 } },
  ])("rejects ready payloads with $label", ({ payload }) => {
    expect(() => NOTIFICATION_REGISTRY.watch_session_ready.validatePayload!(payload)).toThrow();
  });

  it("rejects extra keys in needs-beach payloads", () => {
    expect(() => NOTIFICATION_REGISTRY.watch_session_needs_beach.validatePayload!({
      import_id: "import-1", started_at: "2026-10-19T02:00:00Z", timezone: "UTC", extra: true,
    })).toThrow();
  });

  it("falls back to the UTC date for an invalid IANA timezone", () => {
    const def = NOTIFICATION_REGISTRY.watch_session_needs_beach;
    const payload = def.validatePayload!({
      import_id: "import-1", started_at: "2026-10-19T02:00:00Z", timezone: "Not/A_Timezone",
    });
    expect(def.buildPushPayload!(payload)).toEqual({
      title: "Pick the beach for your surf",
      body: "Your Oct 19 surf needs a beach before it can be saved",
      data: { type: "watch_session_needs_beach", import_id: "import-1", url: "/sessions/imports/import-1", deeplink: "quiver://sessions/imports/import-1" },
    });
  });

});

it.each(["watch_session_ready", "watch_session_needs_beach"] as const)("opens the web target for %s through the service worker fallback", async type => {
  const listeners = new Map<string, (event: unknown) => void>();
  const openWindow = jest.fn();
  runInNewContext(readFileSync("public/firebase-messaging-sw.js", "utf8"), {
    importScripts: jest.fn(),
    firebase: { initializeApp: jest.fn(), messaging: () => ({ onBackgroundMessage: jest.fn() }) },
    console: { log: jest.fn() },
    self: { location: { origin: "https://www.quiversurf.app" }, addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener) },
    clients: { matchAll: async () => [], openWindow },
  });
  const data = type === "watch_session_ready"
    ? NOTIFICATION_REGISTRY.watch_session_ready.buildPushPayload!({ session_id: "session-1", beach_name: "Scripps", wave_count: 1 }).data
    : NOTIFICATION_REGISTRY.watch_session_needs_beach.buildPushPayload!({ import_id: "import-1", started_at: "2026-10-19T02:00:00Z" }).data;
  let finished: Promise<unknown> | undefined;
  listeners.get("notificationclick")!({ notification: { data, close: jest.fn() }, waitUntil: (work: Promise<unknown>) => { finished = work; } });
  await finished;
  expect(openWindow).toHaveBeenCalledWith(`https://www.quiversurf.app${type === "watch_session_ready" ? "/sessions/session-1" : "/sessions/imports/import-1"}`);
});
