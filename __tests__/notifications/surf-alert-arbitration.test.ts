import { selectSurfAlertWinners } from "@/lib/notifications/worker";

const base = {
  recipient_user_id: "user-1",
  entity_id: "beach-1",
  payload: { alert_date: "2026-07-13", beach_id: "beach-1" },
};

describe("selectSurfAlertWinners", () => {
  it("keeps one same-beach surf alert and prefers condition, then similarity, then home", () => {
    const result = selectSurfAlertWinners([
      { ...base, id: "home", type: "home_morning_call" },
      { ...base, id: "similarity", type: "similarity_match" },
      { ...base, id: "condition", type: "forecast_alert" },
      { ...base, id: "other-beach", entity_id: "beach-2", payload: { alert_date: "2026-07-13", beach_id: "beach-2" }, type: "home_morning_call" },
    ]);

    expect(result.winners.map((event) => event.id).sort()).toEqual(["condition", "other-beach"]);
    expect(result.redundant.map((event) => event.id).sort()).toEqual(["home", "similarity"]);
    expect(result.redundant.map((event) => event.id)).toEqual(["similarity", "home"]);
  });
});
