import { consolidateQueueItems } from "@/lib/alerts/payload-builder";

const baseItem = {
  id: "q1", user_id: "user-1", rule_id: "rule-1", beach_id: "beach-1",
  alert_date: "2026-04-01", send_at: "2026-04-01T13:00:00Z",
  window_start: "2026-04-01T15:00:00Z", window_end: "2026-04-01T18:00:00Z",
  best_hour: "2026-04-01T16:00:00Z",
  conditions_snapshot: { wave_height: 4, wind_speed: 5, tide_height: 3.5, tide_status: "rising" },
  sent: false, rule_name: "Glass-Off", beach_name: "Blacks Beach",
  beach_timezone: "America/Los_Angeles", notify_email: true, notify_push: true, best_score: 0.8,
};

describe("consolidateQueueItems", () => {
  it("groups items by user into a single payload", () => {
    const items = [baseItem, { ...baseItem, id: "q2", rule_id: "rule-2", beach_id: "beach-2", beach_name: "Trestles", rule_name: "Big Day" }];
    const payloads = consolidateQueueItems(items);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].matches).toHaveLength(2);
  });

  it("sorts matches by best_score descending", () => {
    const items = [
      { ...baseItem, id: "q1", best_score: 0.5 },
      { ...baseItem, id: "q2", rule_id: "rule-2", beach_name: "Trestles", best_score: 0.9 },
    ];
    const payloads = consolidateQueueItems(items);
    expect(payloads[0].matches[0].beach_name).toBe("Trestles");
  });

  it("uses earliest send_at for the payload", () => {
    const items = [
      { ...baseItem, id: "q1", send_at: "2026-04-01T14:00:00Z" },
      { ...baseItem, id: "q2", send_at: "2026-04-01T13:00:00Z" },
    ];
    const payloads = consolidateQueueItems(items);
    expect(payloads[0].send_at).toBe("2026-04-01T13:00:00Z");
  });
});
