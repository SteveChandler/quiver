/**
 * @jest-environment node
 *
 * Registry contract tests — pin the channel/pref shape so future edits
 * surface as test failures instead of silent regressions.
 */

import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

describe("NOTIFICATION_REGISTRY — Phase 5h informational consolidation", () => {
  it("home_morning_call and weekend_window are registered as push-only reminders", () => {
    const registry = NOTIFICATION_REGISTRY as any;

    for (const key of ["home_morning_call", "weekend_window"]) {
      expect(registry[key].channels).toEqual(["push"]);
      expect(registry[key].prefs.master.push).toBe("notif_push_enabled");
      expect(registry[key].prefs.perType.push).toBe("notif_reminders");
      expect(registry[key].quietHours.mode).toBe("defer");
      expect(registry[key].suppressSelfNotify).toBe(false);
    }
  });

  it("weekend_window rejects location and full-ranking data", () => {
    const def = (NOTIFICATION_REGISTRY as any).weekend_window;
    expect(() => def.validatePayload({
      snapshot_id: "11111111-1111-4111-8111-111111111111",
      weekend_start: "2026-07-25",
      weekend_end: "2026-07-26",
      qualifying_count: 3,
      lead_beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_name: "Black's",
      lead_window_local: "Saturday morning",
      lat: 32.81,
      results: [],
    })).toThrow();
  });

  it("forecast_alert restores push alongside in_app", () => {
    const def = NOTIFICATION_REGISTRY.forecast_alert as unknown as {
      channels: string[];
      prefs: { master: Record<string, unknown>; perType: Record<string, unknown> };
    };
    expect(def.channels).toEqual(["push", "in_app"]);
    expect(def.prefs.master.push).toBe("notif_push_enabled");
    expect(def.prefs.perType.push).toBe("notif_forecast_alerts");
  });

  it("forecast_alert push payload carries forecast_at for native selected-window routing", () => {
    const out = NOTIFICATION_REGISTRY.forecast_alert.buildPushPayload!({
      alert_date: "2026-05-10",
      title: "Conditions lining up today",
      body: "Cardiff 7am-9am",
      beach_id: "beach-1",
      forecast_at: "2026-05-10T14:30:00.000Z",
    });
    expect(out.data).toMatchObject({
      type: "forecast_alert",
      utm_source: "quiver",
      utm_medium: "push",
      utm_campaign: "conditions_alert",
      email_type: "conditions_alert",
      beach_id: "beach-1",
      forecast_at: "2026-05-10T14:30:00.000Z",
    });
  });

  it("forecast_alert in-app payload carries selected-window beach context", () => {
    const out = NOTIFICATION_REGISTRY.forecast_alert.buildInAppPayload!({
      alert_date: "2026-05-10",
      title: "Conditions lining up today",
      body: "Cardiff 7am-9am",
      beach_id: "beach-1",
      beach_slug: "cardiff-reef",
      forecast_at: "2026-05-10T14:30:00.000Z",
      matches: [{ beach_name: "Cardiff Reef" }],
    });

    expect(out.data).toMatchObject({
      alert_date: "2026-05-10",
      title: "Conditions lining up today",
      body: "Cardiff 7am-9am",
      beach_id: "beach-1",
      beach_slug: "cardiff-reef",
      forecast_at: "2026-05-10T14:30:00.000Z",
    });
  });

  it("water_quality delivers on push and in_app, gated by the single wq toggle", () => {
    const def = NOTIFICATION_REGISTRY.water_quality as unknown as {
      channels: string[];
      prefs: { master: Record<string, unknown>; perType: Record<string, unknown> };
    };
    expect(def.channels).toEqual(["push", "in_app"]);
    // Both channels honor their master pref...
    expect(def.prefs.master.push).toBe("notif_push_enabled");
    expect(def.prefs.master.in_app).toBe("notif_inapp_enabled");
    // ...and the single per-type toggle gates both, so turning it off kills
    // push AND inbox rows.
    expect(def.prefs.perType.push).toBe("notif_water_quality");
    expect(def.prefs.perType.in_app).toBe("notif_water_quality");
  });

  it("water_quality closure push reads more urgent than an advisory", () => {
    const base = {
      beach_id: "beach-1",
      beach_slug: "ocean-beach",
      beach_name: "Ocean Beach",
      status_changed_at: "2026-06-13T12:00:00.000Z",
    };

    const closure = NOTIFICATION_REGISTRY.water_quality.buildPushPayload!({
      ...base,
      status: "closure",
      previous_status: "advisory",
    });
    expect(closure.title).toBe("Beach closed: Ocean Beach");
    expect(closure.body).toMatch(/don't enter the water/i);
    expect(closure.body).toMatch(/bacteria/i);

    const advisory = NOTIFICATION_REGISTRY.water_quality.buildPushPayload!({
      ...base,
      status: "advisory",
      previous_status: "good",
    });
    expect(advisory.title).toBe("Water advisory: Ocean Beach");
    expect(advisory.body).toMatch(/check before paddling out/i);
    // Advisory must NOT carry the harder closure language.
    expect(advisory.body).not.toMatch(/don't enter the water/i);

    // The closure title is the unambiguously stronger of the two.
    expect(closure.title).not.toBe(advisory.title);
  });

  it("water_quality recovery push reads as all-clear", () => {
    const recovery = NOTIFICATION_REGISTRY.water_quality.buildPushPayload!({
      beach_id: "beach-1",
      beach_slug: "ocean-beach",
      beach_name: "Ocean Beach",
      status: "good",
      previous_status: "closure",
      status_changed_at: "2026-06-13T12:00:00.000Z",
    });
    expect(recovery.title).toBe("All clear: Ocean Beach");
    expect(recovery.body).toMatch(/safe levels/i);
  });

  it("daily_digest is fully disabled", () => {
    expect(NOTIFICATION_REGISTRY.daily_digest.channels).toEqual([]);
  });

  it("daily_digest schema accepts forecast_summary and water_quality_summary", () => {
    const validated = NOTIFICATION_REGISTRY.daily_digest.validatePayload!({
      alert_date: "2026-04-30",
      title: "Conditions firing",
      body: "Top match: Ocean Beach",
      forecast_summary: { top_match: "Ocean Beach", match_count: 3 },
      water_quality_summary: { advisory_count: 1, closure_count: 0 },
    });
    expect(validated).toMatchObject({
      forecast_summary: { top_match: "Ocean Beach", match_count: 3 },
      water_quality_summary: { advisory_count: 1, closure_count: 0 },
    });
  });

  it("daily_digest push body summarizes water-quality state when advisory_count > 0", () => {
    const out = NOTIFICATION_REGISTRY.daily_digest.buildPushPayload!({
      alert_date: "2026-04-30",
      title: "Daily digest",
      body: "Top match: Ocean Beach",
      forecast_summary: { top_match: "Ocean Beach", match_count: 3 },
      water_quality_summary: { advisory_count: 2, closure_count: 1 },
    });
    expect(out.body).toMatch(/Water quality/);
    expect(out.body).toMatch(/1 closure/);
    expect(out.body).toMatch(/2 advisories/);
  });

  it("daily_digest push body falls back to producer body when no water-quality issues", () => {
    const out = NOTIFICATION_REGISTRY.daily_digest.buildPushPayload!({
      alert_date: "2026-04-30",
      title: "Daily digest",
      body: "Top match: Ocean Beach",
      water_quality_summary: { advisory_count: 0, closure_count: 0 },
    });
    expect(out.body).toBe("Top match: Ocean Beach");
  });
});

describe("NOTIFICATION_REGISTRY — Phase 5i admin types", () => {
  it("admin_test is push-only, master-pref only, quietHours.ignore", () => {
    const def = NOTIFICATION_REGISTRY.admin_test;
    expect(def.channels).toEqual(["push"]);
    expect(def.prefs.master.push).toBe("notif_push_enabled");
    expect(def.prefs.perType).toEqual({});
    expect(def.quietHours.mode).toBe("ignore");
    expect(def.suppressSelfNotify).toBe(false);
  });

  it("admin_broadcast is push-only, master-pref only, quietHours.bypass", () => {
    const def = NOTIFICATION_REGISTRY.admin_broadcast;
    expect(def.channels).toEqual(["push"]);
    expect(def.prefs.master.push).toBe("notif_push_enabled");
    expect(def.prefs.perType).toEqual({});
    expect(def.quietHours.mode).toBe("bypass");
  });
});
