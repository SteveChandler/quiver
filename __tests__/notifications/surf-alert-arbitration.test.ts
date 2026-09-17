import { selectSurfAlertWinners } from "@/lib/notifications/worker";

const base = {
  recipient_user_id: "user-1",
  entity_id: "beach-1",
  payload: { alert_date: "2026-07-13", beach_id: "beach-1" },
};

describe("selectSurfAlertWinners", () => {
  it("keeps one surf alert per user and date across different beaches", () => {
    const result = selectSurfAlertWinners([
      {
        ...base,
        id: "daily",
        entity_id: "beach-2",
        payload: { alert_date: "2026-07-13", beach_id: "beach-2" },
        type: "daily_call",
      },
      { ...base, id: "manual", type: "forecast_alert" },
    ]);

    expect(result.winners.map((event) => event.id)).toEqual(["manual"]);
    expect(result.redundant.map((event) => event.id)).toEqual(["daily"]);
  });
});
