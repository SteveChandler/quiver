import {
  createForecastHandoffBlendState,
  processForecastHandoffBlendSlot,
} from "@/lib/utils/forecast-handoff-blend";
import type { WaveHeightSourceTag } from "@/lib/utils/wave-height-source";

function step(args: {
  forecastAt: string;
  waveHeight: string | null;
  source: WaveHeightSourceTag | null;
}) {
  const state = createForecastHandoffBlendState();
  processForecastHandoffBlendSlot({
    state,
    slot: {
      forecastAt: "2026-07-04T00:00:00Z",
      waveHeight: "4.0 ft",
      dataSource: "CDIP",
      waveHeightSource: "cdip_sig",
    },
  });
  return processForecastHandoffBlendSlot({
    state,
    slot: {
      forecastAt: args.forecastAt,
      waveHeight: args.waveHeight,
      dataSource: "NOAA_NWS",
      waveHeightSource: args.source,
    },
  });
}

describe("forecast handoff seam metric", () => {
  it("measures the seam and clamps the reported ratio to [0.5, 2.0]", () => {
    const high = step({
      forecastAt: "2026-07-04T03:00:00Z",
      waveHeight: "1.0 ft",
      source: "model_swell",
    });
    expect(high.metric).toEqual(
      expect.objectContaining({
        handoffDiscontinuityFt: 3,
        rawRatio: 4,
        clampedRatio: 2,
      }),
    );

    const low = step({
      forecastAt: "2026-07-04T03:00:00Z",
      waveHeight: "16.0 ft",
      source: "model_swell",
    });
    expect(low.metric?.rawRatio).toBe(0.25);
    expect(low.metric?.clampedRatio).toBe(0.5);
  });

  // #1236: The Rock, Oceanside on 2026-10-28. CDIP read 4.3 ft at the seam
  // while a SSW 13 s groundswell built 2.3 -> 2.8 -> 3.2 ft on the model. The
  // old 48 h taper showed 4.1 -> 3.7 -> 3.2, falling while the swell grew.
  it("reports the seam once and never rescales the model rows after it", () => {
    const state = createForecastHandoffBlendState();
    processForecastHandoffBlendSlot({
      state,
      slot: {
        forecastAt: "2026-10-29T06:00:00Z",
        waveHeight: "4.3 ft",
        dataSource: "CDIP",
        waveHeightSource: "cdip_sig",
      },
    });
    const steps = [
      "2026-10-29T09:00:00Z",
      "2026-10-29T15:00:00Z",
      "2026-10-30T15:00:00Z",
      "2026-10-31T15:00:00Z",
    ].map((forecastAt, i) =>
      processForecastHandoffBlendSlot({
        state,
        slot: {
          forecastAt,
          waveHeight: ["2.3 ft", "2.3 ft", "2.8 ft", "3.2 ft"][i],
          dataSource: "OPEN_METEO",
          waveHeightSource: "model_swell",
        },
      }),
    );

    expect(steps[0].metric).toEqual(
      expect.objectContaining({
        cdipFaceFt: 4.3,
        modelFaceFt: 2.3,
        handoffDiscontinuityFt: 2,
        rawRatio: 1.87,
      }),
    );
    expect(steps.slice(1).map((s) => s.metric)).toEqual([null, null, null]);
    for (const s of steps) expect(Object.keys(s)).toEqual(["metric"]);
  });

  it("ignores invalid values, fallback rows, and anchor rows", () => {
    expect(
      step({ forecastAt: "2026-07-04T03:00:00Z", waveHeight: "Flat", source: "model_swell" }).metric,
    ).toBeNull();
    expect(
      step({ forecastAt: "2026-07-04T03:00:00Z", waveHeight: "1.0-2.0ft", source: "model_swell" }).metric,
    ).toBeNull();
    expect(
      step({ forecastAt: "2026-07-04T03:00:00Z", waveHeight: "1.0 ft", source: "ndbc_buoy" }).metric,
    ).toBeNull();
    expect(
      step({ forecastAt: "2026-07-04T03:00:00Z", waveHeight: "1.0 ft", source: "nowcast_anchor" }).metric,
    ).toBeNull();
  });

  it("does not measure CDIP-window rows that fell back to model provenance", () => {
    const state = createForecastHandoffBlendState();
    processForecastHandoffBlendSlot({
      state,
      slot: {
        forecastAt: "2026-07-04T00:00:00Z",
        waveHeight: "4.0 ft",
        dataSource: "CDIP",
        waveHeightSource: "cdip_sig",
      },
    });

    const result = processForecastHandoffBlendSlot({
      state,
      slot: {
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "1.0 ft",
        dataSource: "CDIP",
        waveHeightSource: "model_swell",
      },
    });

    expect(result.metric).toBeNull();
  });

  it("does not reuse a stale CDIP anchor after a CDIP-window model row", () => {
    const state = createForecastHandoffBlendState();
    processForecastHandoffBlendSlot({
      state,
      slot: {
        forecastAt: "2026-07-04T00:00:00Z",
        waveHeight: "4.0 ft",
        dataSource: "CDIP",
        waveHeightSource: "cdip_sig",
      },
    });
    processForecastHandoffBlendSlot({
      state,
      slot: {
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "1.0 ft",
        dataSource: "CDIP",
        waveHeightSource: "model_swell",
      },
    });

    const laterModel = processForecastHandoffBlendSlot({
      state,
      slot: {
        forecastAt: "2026-07-04T06:00:00Z",
        waveHeight: "1.0 ft",
        dataSource: "NOAA_NWS",
        waveHeightSource: "model_swell",
      },
    });

    expect(laterModel.metric).toBeNull();
  });
});
