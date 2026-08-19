import type {
  AlertConditions,
  BeachAlertMeta,
  ConsolidatedAlertPayload,
  MatchingWindow,
} from "./types";

export type AlertRevalidationBeachMeta = BeachAlertMeta & {
  break_type?: string | null;
  skill_level?: string | null;
};

export interface QueueItemWithMeta {
  id: string;
  user_id: string;
  rule_id: string;
  beach_id: string;
  alert_date: string;
  send_at: string;
  window_start: string;
  window_end: string;
  best_hour: string;
  forecast_id?: string;
  conditions_snapshot: Record<string, unknown>;
  sent: boolean;
  rule_name: string;
  preset_type?: string | null;
  beach_name: string;
  beach_slug?: string | null;
  beach_skill_level?: string | null;
  beach_timezone: string;
  notify_email: boolean;
  notify_push: boolean;
  best_score: number;
  conditions?: AlertConditions | null;
  beach_meta?: AlertRevalidationBeachMeta | null;
}

export function consolidateQueueItems(items: QueueItemWithMeta[]): ConsolidatedAlertPayload[] {
  const byUserBeach = new Map<string, QueueItemWithMeta[]>();
  for (const item of items) {
    const key = `${item.user_id}:${item.beach_id}`;
    const existing = byUserBeach.get(key) ?? [];
    existing.push(item);
    byUserBeach.set(key, existing);
  }

  const payloads: ConsolidatedAlertPayload[] = [];
  for (const userItems of byUserBeach.values()) {
    const userId = userItems[0].user_id;
    const sorted = userItems.sort((a, b) => b.best_score - a.best_score);
    const earliestSendAt = userItems.reduce(
      (min, item) => (item.send_at < min ? item.send_at : min),
      userItems[0].send_at
    );
    const matches: MatchingWindow[] = sorted.map((item) => ({
      rule_id: item.rule_id, rule_name: item.rule_name,
      beach_id: item.beach_id, beach_name: item.beach_name,
      beach_slug: item.beach_slug ?? null,
      beach_skill_level:
        item.beach_skill_level ?? item.beach_meta?.skill_level ?? null,
      beach_timezone: item.beach_timezone,
      window_start: item.window_start, window_end: item.window_end,
      best_hour: item.best_hour, best_score: item.best_score,
      forecast_id: item.forecast_id,
      conditions_snapshot: item.conditions_snapshot,
      notify_email: item.notify_email, notify_push: item.notify_push,
    }));
    payloads.push({ user_id: userId, alert_date: userItems[0].alert_date, send_at: earliestSendAt, matches });
  }
  return payloads;
}
