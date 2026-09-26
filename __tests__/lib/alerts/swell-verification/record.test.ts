/**
 * @jest-environment node
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  recordSwellEventForecast,
  type SwellEventForecastRecord,
} from "@/lib/alerts/swell-verification/record";
import type { Database } from "@/types/database";

const record: SwellEventForecastRecord = {
  eventKey: "11111111-1111-4111-8111-111111111111:2026-09-20",
  beachId: "11111111-1111-4111-8111-111111111111",
  source: "alert",
  detectorVersion: "swell-watch-detector.v1",
  issuedAt: "2026-09-18T00:00:00.000Z",
  arrivalAt: "2026-09-18T07:00:00.000Z",
  peakAt: "2026-09-20T15:00:00.000Z",
  fadeAt: null,
  peakOffshoreHeightFt: 4.5,
  peakFaceHeightFt: 6,
  peakPeriodS: 17,
  directionDeg: 315,
};

function client(result: { data: unknown; error: { message: string } | null }) {
  const select = jest.fn(async () => result);
  const upsert = jest.fn(() => ({ select }));
  const from = jest.fn(() => ({ upsert }));
  return {
    supabase: { from } as unknown as SupabaseClient<Database>,
    from,
    upsert,
    select,
  };
}

describe("recordSwellEventForecast", () => {
  it("inserts the snake_case row and ignores an existing event, beach and source", async () => {
    const mock = client({ data: [{ id: "row-1" }], error: null });

    await expect(recordSwellEventForecast(mock.supabase, record)).resolves.toEqual({ inserted: true });

    expect(mock.from).toHaveBeenCalledWith("swell_event_verifications");
    expect(mock.upsert).toHaveBeenCalledWith({
      event_key: "11111111-1111-4111-8111-111111111111:2026-09-20",
      beach_id: "11111111-1111-4111-8111-111111111111",
      source: "alert",
      detector_version: "swell-watch-detector.v1",
      forecast_issued_at: "2026-09-18T00:00:00.000Z",
      forecast_arrival_at: "2026-09-18T07:00:00.000Z",
      forecast_peak_at: "2026-09-20T15:00:00.000Z",
      forecast_fade_at: null,
      forecast_peak_offshore_height_ft: 4.5,
      forecast_peak_face_height_ft: 6,
      forecast_peak_period_s: 17,
      forecast_direction_deg: 315,
    }, {
      onConflict: "event_key,beach_id,source",
      ignoreDuplicates: true,
    });
    expect(mock.select).toHaveBeenCalledWith("id");
  });

  it("reports no insert when the row already existed", async () => {
    const mock = client({ data: [], error: null });

    await expect(recordSwellEventForecast(mock.supabase, record)).resolves.toEqual({ inserted: false });
  });

  it("throws the database error so the caller can count it", async () => {
    const mock = client({ data: null, error: { message: "permission denied" } });

    await expect(recordSwellEventForecast(mock.supabase, record)).rejects.toThrow(
      "Failed to record swell event forecast: permission denied",
    );
  });
});
