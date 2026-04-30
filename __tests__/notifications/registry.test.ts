/**
 * @jest-environment node
 *
 * Registry contract tests — pin the channel/pref shape so future edits
 * surface as test failures instead of silent regressions.
 */

import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

describe("NOTIFICATION_REGISTRY — Phase 5h informational consolidation", () => {
  it("forecast_alert has only the in_app channel (no push)", () => {
    expect(NOTIFICATION_REGISTRY.forecast_alert.channels).toEqual(["in_app"]);
    expect(NOTIFICATION_REGISTRY.forecast_alert.prefs.master.push).toBeUndefined();
    expect(NOTIFICATION_REGISTRY.forecast_alert.prefs.perType.push).toBeUndefined();
  });

  it("water_quality has only the in_app channel (no push)", () => {
    expect(NOTIFICATION_REGISTRY.water_quality.channels).toEqual(["in_app"]);
    expect(NOTIFICATION_REGISTRY.water_quality.prefs.master.push).toBeUndefined();
    expect(NOTIFICATION_REGISTRY.water_quality.prefs.perType.push).toBeUndefined();
  });

  it("daily_digest still pushes (and writes in_app)", () => {
    expect(NOTIFICATION_REGISTRY.daily_digest.channels).toEqual([
      "push",
      "in_app",
    ]);
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
    const out = NOTIFICATION_REGISTRY.daily_digest.buildPushPayload!(
      {
        alert_date: "2026-04-30",
        title: "Daily digest",
        body: "Top match: Ocean Beach",
        forecast_summary: { top_match: "Ocean Beach", match_count: 3 },
        water_quality_summary: { advisory_count: 2, closure_count: 1 },
      },
      {
        recipientUserId: "u",
        actorUserId: null,
        recipient: { display_name: null, timezone: null },
        actor: null,
      }
    );
    expect(out.body).toMatch(/Water quality/);
    expect(out.body).toMatch(/1 closure/);
    expect(out.body).toMatch(/2 advisories/);
  });

  it("daily_digest push body falls back to producer body when no water-quality issues", () => {
    const out = NOTIFICATION_REGISTRY.daily_digest.buildPushPayload!(
      {
        alert_date: "2026-04-30",
        title: "Daily digest",
        body: "Top match: Ocean Beach",
        water_quality_summary: { advisory_count: 0, closure_count: 0 },
      },
      {
        recipientUserId: "u",
        actorUserId: null,
        recipient: { display_name: null, timezone: null },
        actor: null,
      }
    );
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
