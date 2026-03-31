import type { ConsolidatedAlertPayload, MatchingWindow } from "./types";

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
  conditions_snapshot: Record<string, unknown>;
  sent: boolean;
  rule_name: string;
  beach_name: string;
  beach_timezone: string;
  notify_email: boolean;
  notify_push: boolean;
  best_score: number;
}

export function consolidateQueueItems(items: QueueItemWithMeta[]): ConsolidatedAlertPayload[] {
  const byUser = new Map<string, QueueItemWithMeta[]>();
  for (const item of items) {
    const existing = byUser.get(item.user_id) ?? [];
    existing.push(item);
    byUser.set(item.user_id, existing);
  }

  const payloads: ConsolidatedAlertPayload[] = [];
  for (const [userId, userItems] of byUser) {
    const sorted = userItems.sort((a, b) => b.best_score - a.best_score);
    const earliestSendAt = userItems.reduce(
      (min, item) => (item.send_at < min ? item.send_at : min),
      userItems[0].send_at
    );
    const matches: MatchingWindow[] = sorted.map((item) => ({
      rule_id: item.rule_id, rule_name: item.rule_name,
      beach_id: item.beach_id, beach_name: item.beach_name,
      beach_timezone: item.beach_timezone,
      window_start: item.window_start, window_end: item.window_end,
      best_hour: item.best_hour, best_score: item.best_score,
      conditions_snapshot: item.conditions_snapshot,
      notify_email: item.notify_email, notify_push: item.notify_push,
    }));
    payloads.push({ user_id: userId, alert_date: userItems[0].alert_date, send_at: earliestSendAt, matches });
  }
  return payloads;
}
