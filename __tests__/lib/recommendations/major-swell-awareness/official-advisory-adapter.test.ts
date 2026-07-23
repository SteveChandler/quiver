import {
  loadNwsSwellAdvisories,
  nwsAlertsToSwellAdvisories,
  officialRiskRowsToSwellAdvisories,
} from "@/lib/recommendations/major-swell-awareness/official-advisory-adapter";

describe("official swell advisory adapter", () => {
  const now = new Date("2026-07-01T15:00:00.000Z");

  it("maps fresh official high-risk rows into beach-scoped evidence", () => {
    expect(officialRiskRowsToSwellAdvisories({
      rows: [{
        id: "11111111-1111-4111-8111-111111111111",
        beach_id: "beach-1",
        valid_date: "2026-07-02",
        risk_level: "high",
        source: "alert",
        fetched_at: "2026-07-01T14:30:00.000Z",
      }],
      beachId: "beach-1",
      timezone: "America/Los_Angeles",
      now,
    })).toEqual([{
      evidenceRef:
        "official:rip_current_risks:11111111-1111-4111-8111-111111111111",
      kind: "high_rip_current",
      startsAt: "2026-07-02T07:00:00.000Z",
      endsAt: "2026-07-03T07:00:00.000Z",
      beachIds: ["beach-1"],
    }]);
  });

  it("rejects stale, derived, wrong-beach, and non-high rows", () => {
    const base = {
      id: "11111111-1111-4111-8111-111111111111",
      beach_id: "beach-1",
      valid_date: "2026-07-02",
      risk_level: "high",
      source: "alert",
      fetched_at: "2026-07-01T14:30:00.000Z",
    };

    expect(officialRiskRowsToSwellAdvisories({
      rows: [
        { ...base, id: "stale", fetched_at: "2026-06-29T00:00:00.000Z" },
        { ...base, id: "derived", source: "derived" },
        { ...base, id: "other", beach_id: "beach-2" },
        { ...base, id: "moderate", risk_level: "moderate" },
      ],
      beachId: "beach-1",
      timezone: "America/Los_Angeles",
      now,
    })).toEqual([]);
  });

  it.each([
    ["High Surf Warning", "high_surf"],
    ["Hurricane Warning", "tropical_cyclone"],
    ["Tropical Storm Watch", "tropical_cyclone"],
    ["Rip Current Statement", "high_rip_current"],
  ])("classifies the official NWS %s", (event, kind) => {
    expect(nwsAlertsToSwellAdvisories({
      payload: {
        features: [{
          id: `https://api.weather.gov/alerts/${kind}`,
          properties: {
            event,
            onset: "2026-07-02T00:00:00-07:00",
            ends: "2026-07-03T00:00:00-07:00",
          },
        }],
      },
      beachId: "beach-1",
      now,
    })).toEqual([expect.objectContaining({
      evidenceRef: `official:nws_alert:https://api.weather.gov/alerts/${kind}`,
      kind,
      startsAt: "2026-07-02T07:00:00.000Z",
      endsAt: "2026-07-03T07:00:00.000Z",
      beachIds: ["beach-1"],
    })]);
  });

  it("ignores unrelated and expired NWS alerts", () => {
    expect(nwsAlertsToSwellAdvisories({
      payload: {
        features: [
          {
            id: "wind",
            properties: {
              event: "Wind Advisory",
              onset: "2026-07-02T00:00:00Z",
              ends: "2026-07-03T00:00:00Z",
            },
          },
          {
            id: "expired",
            properties: {
              event: "High Surf Advisory",
              onset: "2026-06-29T00:00:00Z",
              ends: "2026-06-30T00:00:00Z",
            },
          },
        ],
      },
      beachId: "beach-1",
      now,
    })).toEqual([]);
  });

  it("reuses one NWS zone response while scoping evidence to each beach", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{
          id: "shared-zone-alert",
          properties: {
            event: "High Surf Warning",
            onset: "2026-07-02T00:00:00-07:00",
            ends: "2026-07-03T00:00:00-07:00",
          },
        }],
      }),
    });

    const first = await loadNwsSwellAdvisories({
      zone: "CAZ999",
      beachId: "beach-1",
      now,
      fetchImpl,
    });
    const second = await loadNwsSwellAdvisories({
      zone: "CAZ999",
      beachId: "beach-2",
      now,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first[0].beachIds).toEqual(["beach-1"]);
    expect(second[0].beachIds).toEqual(["beach-2"]);
  });
});
