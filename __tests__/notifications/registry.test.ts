/**
 * @jest-environment node
 *
 * Registry contract tests — pin the channel/pref shape so future edits
 * surface as test failures instead of silent regressions.
 */

import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

describe("NOTIFICATION_REGISTRY — Phase 5h informational consolidation", () => {
  it("keeps watched-call payloads bounded and category-specific", () => {
    const def = NOTIFICATION_REGISTRY.watched_call_update;
    const payload = def.validatePayload!({
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
      body: "The stronger window is now 10 AM–noon.",
    });

    expect(def.buildPushPayload!(payload).data).toEqual(expect.objectContaining({
      type: "watched_call_update",
      category: "call_changed",
      alert_rule_id: "rule-1",
      recommendation_id: "recommendation-2",
      prior_recommendation_id: "recommendation-1",
      beach_id: "beach-1",
      forecast_at: "2026-08-25T18:00:00.000Z",
    }));
    expect(JSON.stringify(payload)).not.toMatch(/latitude|longitude|evidence|notes|token/i);
    expect(def.channels).toEqual(["push", "in_app"]);
    expect(def.prefs.perType.push).toBe("notif_forecast_alerts");
  });

  it.each([
    ["still_on", 24],
    ["call_changed", 6],
    ["better_nearby", 12],
    ["post_window", 168],
  ] as const)("uses a %sh cooldown for %s updates", (category, hours) => {
    const def = NOTIFICATION_REGISTRY.watched_call_update;
    expect(def.cooldownMs!({ category } as never)).toBe(hours * 60 * 60 * 1000);
  });
  it("assigns the native surf-alert sound only to the approved alert payloads", () => {
    const alertPushes = [
      NOTIFICATION_REGISTRY.forecast_alert.buildPushPayload!({
        alert_date: "2026-07-25",
        title: "Conditions lining up",
        body: "Clean window",
      }),
      NOTIFICATION_REGISTRY.similarity_match.buildPushPayload!({
        beach_id: "beach-1",
        beach_slug: "blacks",
        beach_name: "Black's",
        alert_date: "2026-07-25",
        forecast_at: "2026-07-25T16:00:00.000Z",
        score: 8.7,
        reason: "Matches your best sessions",
      }),
      NOTIFICATION_REGISTRY.swell_watch.buildPushPayload!(
        NOTIFICATION_REGISTRY.swell_watch.validatePayload!({
          beach_id: "11111111-1111-4111-8111-111111111111",
          beach_name: "Black's",
          event_start_date: "2026-07-25",
          peak_date: "2026-07-26",
          peak_height_ft: 8,
          peak_period_s: 16,
          forecast_at: "2026-07-25T16:00:00.000Z",
          awareness_mode: "shadow",
          awareness_signal: "forecast_trend",
          awareness_severity: "major",
          title: "Major swell incoming",
          body: "Advanced conditions are approaching.",
        }),
      ),
      NOTIFICATION_REGISTRY.weekend_window.buildPushPayload!({
        snapshot_id: "11111111-1111-4111-8111-111111111111",
        weekend_start: "2026-07-25",
        weekend_end: "2026-07-26",
        qualifying_count: 3,
        beach_id: "22222222-2222-4222-8222-222222222222",
        lead_beach_id: "22222222-2222-4222-8222-222222222222",
        lead_beach_name: "Black's",
        lead_window_local: "Saturday morning",
        forecast_at: "2026-07-25T16:00:00.000Z",
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: "22222222-2222-4222-8222-222222222222",
          starts_at: "2026-07-25T16:00:00.000Z",
          ends_at: "2026-07-25T18:00:00.000Z",
        },
      }),
    ];

    for (const push of alertPushes) {
      expect(push).toMatchObject({
        iosSound: "quiver-alert.wav",
        androidChannelId: "quiver-alerts-v1",
      });
    }

    const ordinaryPush =
      NOTIFICATION_REGISTRY.trial_ending.buildPushPayload!({
        title: "Trial ending",
        body: "Keep your forecast access",
        trial_ends_at: "2026-07-26T16:00:00.000Z",
      });
    expect(ordinaryPush).not.toHaveProperty("iosSound");
    expect(ordinaryPush).not.toHaveProperty("androidChannelId");
  });

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
      beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_name: "Black's",
      lead_window_local: "Saturday morning",
      forecast_at: "2026-07-25T16:00:00.000Z",
      policy_context: {
        kind: "positive_session_recommendation",
        beach_id: "22222222-2222-4222-8222-222222222222",
        starts_at: "2026-07-25T16:00:00.000Z",
        ends_at: "2026-07-25T18:00:00.000Z",
      },
      lat: 32.81,
      results: [],
    })).toThrow();
  });

  it("weekend_window owns the snapshot alert copy and routing summary", () => {
    const def = (NOTIFICATION_REGISTRY as any).weekend_window;
    const payload = {
      snapshot_id: "11111111-1111-4111-8111-111111111111",
      weekend_start: "2026-07-25",
      weekend_end: "2026-07-26",
      qualifying_count: 3,
      beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_name: "Black's",
      lead_window_local: "Saturday morning",
      forecast_at: "2026-07-25T16:00:00.000Z",
      policy_context: {
        kind: "positive_session_recommendation",
        beach_id: "22222222-2222-4222-8222-222222222222",
        starts_at: "2026-07-25T16:00:00.000Z",
        ends_at: "2026-07-25T18:00:00.000Z",
      },
    };
    expect(def.buildPushPayload(def.validatePayload(payload))).toEqual({
      iosSound: "quiver-alert.wav",
      androidChannelId: "quiver-alerts-v1",
      title: "3 spots look promising this weekend",
      body: "Black's leads Saturday morning. See your top picks and why.",
      data: {
        type: "weekend_window",
        snapshot_id: payload.snapshot_id,
        weekend_start: payload.weekend_start,
        weekend_end: payload.weekend_end,
        qualifying_count: payload.qualifying_count,
        lead_beach_id: payload.lead_beach_id,
        lead_beach_name: payload.lead_beach_name,
        lead_window_local: payload.lead_window_local,
      },
    });
    expect(def.buildPushPayload({ ...payload, qualifying_count: 1 }).title).toBe(
      "1 spot looks promising this weekend"
    );
  });

  it("weekend_window rejects safety context that disagrees with the lead result", () => {
    const def = NOTIFICATION_REGISTRY.weekend_window;
    const payload = {
      snapshot_id: "11111111-1111-4111-8111-111111111111",
      weekend_start: "2026-07-25",
      weekend_end: "2026-07-26",
      qualifying_count: 3,
      beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_name: "Black's",
      lead_window_local: "Saturday morning",
      forecast_at: "2026-07-25T16:00:00.000Z",
      policy_context: {
        kind: "positive_session_recommendation" as const,
        beach_id: "33333333-3333-4333-8333-333333333333",
        starts_at: "2026-07-25T17:00:00.000Z",
        ends_at: "2026-07-25T19:00:00.000Z",
      },
    };

    expect(() => def.validatePayload!(payload)).toThrow(/beach IDs/);
    expect(() => def.validatePayload!({
      ...payload,
      policy_context: {
        ...payload.policy_context,
        beach_id: payload.beach_id,
      },
    })).toThrow(/forecast_at/);
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

  it("accepts an official-only swell observation without invented forecast values", () => {
    const parsed = NOTIFICATION_REGISTRY.swell_watch.validatePayload!({
      schema_version: "major-swell-notification.v1",
      beach_id: "11111111-1111-4111-8111-111111111111",
      beach_name: "Black's Beach",
      event_start_date: null,
      peak_date: null,
      peak_height_ft: null,
      peak_period_s: null,
      forecast_at: null,
      awareness_mode: "shadow",
      automation_enabled: false,
      awareness_signal: "official_advisory",
      awareness_severity: "major",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
      enforcement: null,
      title: "Official surf hazard signal — Black's Beach",
      body: "An official coastal advisory is active in the forecast window.",
    });

    expect(parsed).toMatchObject({
      awareness_signal: "official_advisory",
      forecast_at: null,
      peak_height_ft: null,
    });
  });

  it("keeps shadow and enforce major-swell contract capability delivery-disabled", () => {
    const validate = NOTIFICATION_REGISTRY.swell_watch.validatePayload!;

    const shadow = validate({
      schema_version: "major-swell-notification.v1",
      beach_id: "11111111-1111-4111-8111-111111111111",
      beach_name: "Black's Beach",
      event_start_date: "2026-08-01",
      peak_date: "2026-08-02",
      peak_height_ft: 8,
      peak_period_s: 16,
      forecast_at: "2026-08-02T15:00:00.000Z",
      awareness_mode: "shadow",
      automation_enabled: false,
      awareness_signal: "forecast_trend",
      awareness_severity: "major",
      official_evidence_refs: [],
      would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
      enforcement: null,
      title: "Major swell incoming",
      body: "Advanced conditions are approaching.",
    });
    const enforce = validate({
      schema_version: "major-swell-notification.v1",
      beach_id: "11111111-1111-4111-8111-111111111111",
      beach_name: "Black's Beach",
      event_start_date: "2026-08-01",
      peak_date: "2026-08-02",
      peak_height_ft: 8,
      peak_period_s: 16,
      forecast_at: "2026-08-02T15:00:00.000Z",
      awareness_mode: "enforce",
      automation_enabled: true,
      awareness_signal: "corroborated",
      awareness_severity: "major",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
      enforcement: {
        hold_id: "22222222-2222-4222-8222-222222222222",
        hold_record_id: "33333333-3333-4333-8333-333333333333",
        hold_valid_until: "2026-08-03T00:00:00.000Z",
      },
      title: "Major swell incoming",
      body: "Advanced conditions are approaching.",
    });

    expect(shadow.awareness_mode).toBe("shadow");
    expect(shadow.automation_enabled).toBe(false);
    expect(shadow.enforcement).toBeNull();
    expect(enforce.awareness_mode).toBe("enforce");
    expect(enforce.automation_enabled).toBe(true);
    expect(enforce.enforcement).toEqual({
      hold_id: "22222222-2222-4222-8222-222222222222",
      hold_record_id: "33333333-3333-4333-8333-333333333333",
      hold_valid_until: "2026-08-03T00:00:00.000Z",
    });
    expect(NOTIFICATION_REGISTRY.swell_watch.channels).toEqual([]);
  });

  it("normalizes legacy forecast-trend payloads at the registry boundary", () => {
    const payload = NOTIFICATION_REGISTRY.swell_watch.validatePayload!({
      beach_id: "11111111-1111-4111-8111-111111111111",
      beach_slug: "blacks",
      beach_name: "Black's Beach",
      event_start_date: "2026-08-01",
      peak_date: "2026-08-02",
      peak_height_ft: 8,
      peak_period_s: 16,
      forecast_at: "2026-08-02T15:00:00.000Z",
      awareness_mode: "shadow",
      awareness_signal: "forecast_trend",
      awareness_severity: "major",
      title: "Major swell incoming",
      body: "Advanced conditions are approaching.",
    });

    expect(payload).toMatchObject({
      schema_version: "major-swell-notification.v1",
      beach_id: "11111111-1111-4111-8111-111111111111",
      event_start_date: "2026-08-01",
      peak_date: "2026-08-02",
      peak_height_ft: 8,
      peak_period_s: 16,
      forecast_at: "2026-08-02T15:00:00.000Z",
      awareness_mode: "shadow",
      automation_enabled: false,
      awareness_signal: "forecast_trend",
      official_evidence_refs: [],
      would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
      enforcement: null,
    });
  });

  it("does not expose major-swell evidence or hold proof to clients", () => {
    const payload = NOTIFICATION_REGISTRY.swell_watch.validatePayload!({
      schema_version: "major-swell-notification.v1",
      beach_id: "11111111-1111-4111-8111-111111111111",
      beach_slug: "blacks",
      beach_name: "Black's Beach",
      event_start_date: "2026-08-01",
      peak_date: "2026-08-02",
      peak_height_ft: 8,
      peak_period_s: 16,
      forecast_at: "2026-08-02T15:00:00.000Z",
      awareness_mode: "enforce",
      automation_enabled: true,
      awareness_signal: "corroborated",
      awareness_severity: "major",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
      enforcement: {
        hold_id: "22222222-2222-4222-8222-222222222222",
        hold_record_id: "33333333-3333-4333-8333-333333333333",
        hold_valid_until: "2026-08-03T00:00:00.000Z",
      },
      title: "Major swell incoming",
      body: "Advanced conditions are approaching.",
    });

    const push = NOTIFICATION_REGISTRY.swell_watch.buildPushPayload!(payload);
    const inApp = NOTIFICATION_REGISTRY.swell_watch.buildInAppPayload!(payload);
    for (const clientPayload of [push.data, inApp.data]) {
      expect(clientPayload).not.toHaveProperty("official_evidence_refs");
      expect(clientPayload).not.toHaveProperty("would_suppress_cohorts");
      expect(clientPayload).not.toHaveProperty("enforcement");
      expect(JSON.stringify(clientPayload)).not.toContain(
        "22222222-2222-4222-8222-222222222222",
      );
      expect(JSON.stringify(clientPayload)).not.toContain(
        "33333333-3333-4333-8333-333333333333",
      );
      expect(JSON.stringify(clientPayload)).not.toContain(
        "2026-08-03T00:00:00.000Z",
      );
    }
  });

  it("omits nonexistent physical values from official-only push data", () => {
    const officialOnlyPayload = NOTIFICATION_REGISTRY.swell_watch.validatePayload!(
      {
        schema_version: "major-swell-notification.v1",
        beach_id: "11111111-1111-4111-8111-111111111111",
        beach_name: "Black's Beach",
        event_start_date: null,
        peak_date: null,
        peak_height_ft: null,
        peak_period_s: null,
        forecast_at: null,
        awareness_mode: "shadow",
        automation_enabled: false,
        awareness_signal: "official_advisory",
        awareness_severity: "major",
        official_evidence_refs: ["official:nws_alert:high-surf"],
        would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
        enforcement: null,
        title: "Official surf hazard signal — Black's Beach",
        body: "An official coastal advisory is active in the forecast window.",
      },
    );

    const push = NOTIFICATION_REGISTRY.swell_watch.buildPushPayload!(
      officialOnlyPayload,
    );
    expect(push.data).not.toHaveProperty("forecast_at");
    expect(JSON.stringify(push.data)).not.toContain("null");
  });

  it("retains first-session policy context internally but never sends it to FCM", () => {
    const policyContext = {
      kind: "positive_session_recommendation" as const,
      beach_id: "11111111-1111-4111-8111-111111111111",
      starts_at: "2026-07-17T07:00:00.000Z",
      ends_at: "2026-07-18T07:00:00.000Z",
    };
    const parsed = NOTIFICATION_REGISTRY.log_session_nudge.validatePayload!({
      cohort: "free_home_firing",
      title: "Good window at your home break",
      body: "Check today's forecast, and log a session if you paddle out.",
      beach_id: null,
      policy_context: policyContext,
    });

    expect(parsed).toMatchObject({ policy_context: policyContext });
    const push =
      NOTIFICATION_REGISTRY.log_session_nudge.buildPushPayload!(parsed);
    expect(push.data).not.toHaveProperty("policy_context");
    expect(JSON.stringify(push)).not.toContain(policyContext.starts_at);
    expect(push.data).not.toHaveProperty("beach_id");
  });

  it("preserves exact positive windows for each queued alert without channel leakage", () => {
    const policyContext = {
      kind: "positive_session_recommendation" as const,
      beach_id: "11111111-1111-4111-8111-111111111111",
      starts_at: "2026-07-17T16:00:00.000Z",
      ends_at: "2026-07-17T17:00:00.000Z",
    };
    const payloads = {
      forecast_alert: {
        alert_date: "2026-07-17",
        title: "Conditions lining up",
        body: "Clean window",
        beach_id: policyContext.beach_id,
        forecast_at: policyContext.starts_at,
        policy_context: policyContext,
      },
      similarity_match: {
        beach_id: policyContext.beach_id,
        beach_slug: "blacks",
        beach_name: "Blacks",
        alert_date: "2026-07-17",
        forecast_at: policyContext.starts_at,
        score: 8.7,
        reason: "Matches your best sessions",
        policy_context: policyContext,
      },
      home_morning_call: {
        alert_date: "2026-07-17",
        verdict: "YES" as const,
        beach_id: policyContext.beach_id,
        forecast_at: policyContext.starts_at,
        title: "Worth it",
        body: "Clean early window",
        policy_context: policyContext,
      },
    };

    for (const type of Object.keys(payloads) as Array<keyof typeof payloads>) {
      const definition = NOTIFICATION_REGISTRY[type] as any;
      const parsed = definition.validatePayload(payloads[type]);
      expect(parsed.policy_context).toEqual(policyContext);
      const push = definition.buildPushPayload(parsed);
      expect(push.data).not.toHaveProperty("policy_context");
      const channelPayloads = {
        push,
        inApp: definition.buildInAppPayload?.(parsed) ?? null,
      };
      expect(JSON.stringify(channelPayloads)).not.toContain(
        policyContext.ends_at,
      );
    }
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
