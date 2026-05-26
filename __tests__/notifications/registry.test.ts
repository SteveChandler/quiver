/**
 * @jest-environment node
 *
 * Registry contract tests — pin the channel/pref shape so future edits
 * surface as test failures instead of silent regressions.
 */

import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

describe("NOTIFICATION_REGISTRY — Phase 5h informational consolidation", () => {
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

  it("water_quality has only the in_app channel (no push)", () => {
    const def = NOTIFICATION_REGISTRY.water_quality as unknown as {
      channels: string[];
      prefs: { master: Record<string, unknown>; perType: Record<string, unknown> };
    };
    expect(def.channels).toEqual(["in_app"]);
    expect(def.prefs.master.push).toBeUndefined();
    expect(def.prefs.perType.push).toBeUndefined();
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
