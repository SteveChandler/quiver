/**
 * @jest-environment node
 *
 * Registry contract tests for the similarity_match notification type.
 * Pins channels, prefs, payload schema, builders, and the onChannelOutcome
 * fan-out into alert_delivery_attempts so future edits surface as test
 * failures instead of silent regressions.
 *
 * Plan V4 — Agent 3 (Notifications).
 */

import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";
import {
  similarityMatchSchema,
  type SimilarityMatchPayload,
} from "@/lib/notifications/types/similarity-match";
import type { NotificationDeliveryStatus } from "@/lib/notifications/types";

const validPayload: SimilarityMatchPayload = {
  beach_id: "00000000-0000-0000-0000-0000000000b1",
  beach_slug: "ocean-beach-sf",
  beach_name: "Ocean Beach SF",
  alert_date: "2026-05-04",
  forecast_at: "2026-05-04T15:00:00Z",
  score: 8.5,
  label: "EPIC",
  reason: "Conditions match your top sessions",
  queue_items: [
    {
      queue_id: "00000000-0000-0000-0000-0000000000c1",
      rule_id: "00000000-0000-0000-0000-0000000000a1",
    },
  ],
};

describe("NOTIFICATION_REGISTRY.similarity_match — registry shape", () => {
  it("exists in NOTIFICATION_REGISTRY", () => {
    expect(NOTIFICATION_REGISTRY).toHaveProperty("similarity_match");
  });

  it("has channels=['push','in_app']", () => {
    expect(NOTIFICATION_REGISTRY.similarity_match.channels).toEqual([
      "push",
      "in_app",
    ]);
  });

  it("master prefs gate both push and in_app via the global toggles", () => {
    const def = NOTIFICATION_REGISTRY.similarity_match;
    expect(def.prefs.master.push).toBe("notif_push_enabled");
    expect(def.prefs.master.in_app).toBe("notif_inapp_enabled");
  });

  it("perType prefs gate both push and in_app via notif_similarity_alerts", () => {
    const def = NOTIFICATION_REGISTRY.similarity_match;
    expect(def.prefs.perType.push).toBe("notif_similarity_alerts");
    expect(def.prefs.perType.in_app).toBe("notif_similarity_alerts");
  });

  it("uses defer-mode quiet hours (22→04)", () => {
    const def = NOTIFICATION_REGISTRY.similarity_match;
    expect(def.quietHours.mode).toBe("defer");
    expect(def.quietHours.windowStart).toBe(22);
    expect(def.quietHours.windowEnd).toBe(4);
  });

  it("does not suppress self-notify (similarity is not a social type)", () => {
    expect(NOTIFICATION_REGISTRY.similarity_match.suppressSelfNotify).toBe(
      false
    );
  });
});

describe("similarityMatchSchema — payload validation", () => {
  it("validates a complete payload without throwing", () => {
    expect(() => similarityMatchSchema.parse(validPayload)).not.toThrow();
  });

  it("validates a payload without queue_items (optional field)", () => {
    const { queue_items: _qi, ...withoutQueueItems } = validPayload;
    void _qi;
    expect(() => similarityMatchSchema.parse(withoutQueueItems)).not.toThrow();
  });

  it("accepts label=null", () => {
    const parsed = similarityMatchSchema.parse({
      ...validPayload,
      label: null,
    });
    expect(parsed.label).toBeNull();
  });

  it("rejects payload missing beach_id", () => {
    const { beach_id: _bid, ...incomplete } = validPayload;
    void _bid;
    expect(() => similarityMatchSchema.parse(incomplete)).toThrow();
  });

  it("rejects payload missing reason", () => {
    const { reason: _r, ...incomplete } = validPayload;
    void _r;
    expect(() => similarityMatchSchema.parse(incomplete)).toThrow();
  });

  it("rejects payload with non-numeric score", () => {
    expect(() =>
      similarityMatchSchema.parse({ ...validPayload, score: "8.5" })
    ).toThrow();
  });
});

describe("NOTIFICATION_REGISTRY.similarity_match — buildPushPayload", () => {
  it("includes label + beach_name in the title and the reason in the body", () => {
    const out =
      NOTIFICATION_REGISTRY.similarity_match.buildPushPayload!(validPayload);
    expect(out.title).toBe("EPIC match at Ocean Beach SF");
    expect(out.body).toBe("Conditions match your top sessions");
  });

  it("omits leading whitespace when label is missing", () => {
    const out = NOTIFICATION_REGISTRY.similarity_match.buildPushPayload!({
      ...validPayload,
      label: null,
    });
    expect(out.title).toBe("match at Ocean Beach SF");
  });

  it("populates data fields for tap-routing (type, beach_id, beach_slug, alert_date, forecast_at)", () => {
    const out =
      NOTIFICATION_REGISTRY.similarity_match.buildPushPayload!(validPayload);
    expect(out.data).toMatchObject({
      type: "similarity_match",
      beach_id: validPayload.beach_id,
      beach_slug: validPayload.beach_slug,
      alert_date: validPayload.alert_date,
      forecast_at: validPayload.forecast_at,
    });
  });
});

describe("NOTIFICATION_REGISTRY.similarity_match — buildInAppPayload", () => {
  it("uses type='similarity_match' and surfaces all fields in data", () => {
    const out =
      NOTIFICATION_REGISTRY.similarity_match.buildInAppPayload!(validPayload);
    expect(out.type).toBe("similarity_match");
    expect(out.data).toMatchObject({
      beach_id: validPayload.beach_id,
      beach_slug: validPayload.beach_slug,
      beach_name: validPayload.beach_name,
      alert_date: validPayload.alert_date,
      forecast_at: validPayload.forecast_at,
      score: validPayload.score,
      label: validPayload.label,
      reason: validPayload.reason,
    });
  });

  it("normalizes label=undefined to null in the in-app payload", () => {
    const { label: _lbl, ...noLabel } = validPayload;
    void _lbl;
    const out = NOTIFICATION_REGISTRY.similarity_match.buildInAppPayload!(
      noLabel as SimilarityMatchPayload
    );
    expect((out.data as { label: unknown }).label).toBeNull();
  });
});

describe("NOTIFICATION_REGISTRY.similarity_match — onChannelOutcome", () => {
  function makeSupabaseStub() {
    const insertCalls: Array<{ table: string; rows: unknown }> = [];
    const insertResult: { error: { message: string } | null } = { error: null };
    const supabase = {
      from(table: string) {
        return {
          insert(rows: unknown) {
            insertCalls.push({ table, rows });
            return Promise.resolve(insertResult);
          },
        };
      },
    } as unknown as Parameters<
      NonNullable<typeof NOTIFICATION_REGISTRY.similarity_match.onChannelOutcome>
    >[0]["supabase"];
    return { supabase, insertCalls, insertResult };
  }

  function makeEvent(payload: SimilarityMatchPayload) {
    return {
      id: "evt-1",
      recipient_user_id: "00000000-0000-0000-0000-0000000000d1",
      actor_user_id: null,
      type: "similarity_match",
      entity_type: "beach",
      entity_id: payload.beach_id,
      payload,
      created_at: "2026-05-04T05:00:00Z",
    };
  }

  it("on push status='sent' inserts one alert_delivery_attempts row per queue_item with status='sent'", async () => {
    const { supabase, insertCalls } = makeSupabaseStub();
    await NOTIFICATION_REGISTRY.similarity_match.onChannelOutcome!({
      supabase,
      event: makeEvent(validPayload),
      channel: "push",
      status: "sent",
    });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe("alert_delivery_attempts");
    expect(insertCalls[0].rows).toEqual([
      {
        queue_id: validPayload.queue_items![0].queue_id,
        rule_id: validPayload.queue_items![0].rule_id,
        user_id: "00000000-0000-0000-0000-0000000000d1",
        channel: "push",
        status: "sent",
        skip_reason: "sent",
      },
    ]);
  });

  it("maps skipped_pref_master onto skipped_channel_disabled", async () => {
    const { supabase, insertCalls } = makeSupabaseStub();
    await NOTIFICATION_REGISTRY.similarity_match.onChannelOutcome!({
      supabase,
      event: makeEvent(validPayload),
      channel: "push",
      status: "skipped_pref_master",
    });
    expect(insertCalls).toHaveLength(1);
    expect((insertCalls[0].rows as Array<{ status: string }>)[0].status).toBe(
      "skipped_channel_disabled"
    );
  });

  it("does NOT insert for the in_app channel (push-only reconciliation)", async () => {
    const { supabase, insertCalls } = makeSupabaseStub();
    await NOTIFICATION_REGISTRY.similarity_match.onChannelOutcome!({
      supabase,
      event: makeEvent(validPayload),
      channel: "in_app",
      status: "sent",
    });
    expect(insertCalls).toHaveLength(0);
  });

  it("does NOT insert for deferred_quiet_hours (non-terminal)", async () => {
    const { supabase, insertCalls } = makeSupabaseStub();
    await NOTIFICATION_REGISTRY.similarity_match.onChannelOutcome!({
      supabase,
      event: makeEvent(validPayload),
      channel: "push",
      status: "deferred_quiet_hours" as NotificationDeliveryStatus,
    });
    expect(insertCalls).toHaveLength(0);
  });

  it("is a no-op when queue_items is empty (no provenance, nothing to reconcile)", async () => {
    const { supabase, insertCalls } = makeSupabaseStub();
    const { queue_items: _qi, ...noProvenance } = validPayload;
    void _qi;
    await NOTIFICATION_REGISTRY.similarity_match.onChannelOutcome!({
      supabase,
      event: makeEvent(noProvenance as SimilarityMatchPayload),
      channel: "push",
      status: "sent",
    });
    expect(insertCalls).toHaveLength(0);
  });
});
