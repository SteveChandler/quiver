import {
  calculateForecastHandoffBlendFactor,
  createForecastHandoffBlendState,
  processForecastHandoffBlendSlot,
} from "@/lib/utils/forecast-handoff-blend";
import type { WaveHeightSourceTag } from "@/lib/utils/wave-height-source";

function step(args: {
  forecastAt: string;
  waveHeight: string | null;
  source: WaveHeightSourceTag | null;
  enabled?: boolean;
}) {
  const state = createForecastHandoffBlendState();
  processForecastHandoffBlendSlot({
    state,
    enabled: args.enabled ?? true,
    slot: {
      forecastAt: "2026-07-04T00:00:00Z",
      waveHeight: "4.0 ft",
      dataSource: "CDIP",
      waveHeightSource: "cdip_sig",
    },
  });
  return processForecastHandoffBlendSlot({
    state,
    enabled: args.enabled ?? true,
    slot: {
      forecastAt: args.forecastAt,
      waveHeight: args.waveHeight,
      dataSource: "NOAA_NWS",
      waveHeightSource: args.source,
    },
  });
}

describe("forecast handoff blend", () => {
  it("clamps high ratios to 2.0", () => {
    const result = step({
      forecastAt: "2026-07-04T03:00:00Z",
      waveHeight: "1.0 ft",
      source: "model_swell",
    });

    expect(result.metric?.rawRatio).toBe(4);
    expect(result.metric?.clampedRatio).toBe(2);
    expect(result.adjustment?.waveHeight).toBe("2 ft");
  });

  it("clamps low ratios to 0.5", () => {
    const result = step({
      forecastAt: "2026-07-04T03:00:00Z",
      waveHeight: "16.0 ft",
      source: "model_swell",
    });

    expect(result.metric?.rawRatio).toBe(0.25);
    expect(result.metric?.clampedRatio).toBe(0.5);
    expect(result.adjustment?.waveHeight).toBe("8 ft");
  });

  it("tapers back to 1.0 by 48 hours", () => {
    expect(
      calculateForecastHandoffBlendFactor({
        clampedRatio: 2,
        hoursAfterSeam: 0,
      }),
    ).toBe(2);
    expect(
      calculateForecastHandoffBlendFactor({
        clampedRatio: 2,
        hoursAfterSeam: 24,
      }),
    ).toBe(1.5);
    expect(
      calculateForecastHandoffBlendFactor({
        clampedRatio: 2,
        hoursAfterSeam: 48,
      }),
    ).toBe(1);
  });

  it("does not apply to invalid values, fallback rows, or anchor rows", () => {
    expect(
      step({
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "Flat",
        source: "model_swell",
      }).adjustment,
    ).toBeNull();
    expect(
      step({
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "1.0-2.0ft",
        source: "model_swell",
      }).adjustment,
    ).toBeNull();
    expect(
      step({
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "1.0 ft",
        source: "ndbc_buoy",
      }).adjustment,
    ).toBeNull();
    expect(
      step({
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "1.0 ft",
        source: "nowcast_anchor",
      }).adjustment,
    ).toBeNull();
  });

  it("does not apply to CDIP-window rows that fell back to model provenance", () => {
    const state = createForecastHandoffBlendState();
    processForecastHandoffBlendSlot({
      state,
      enabled: true,
      slot: {
        forecastAt: "2026-07-04T00:00:00Z",
        waveHeight: "4.0 ft",
        dataSource: "CDIP",
        waveHeightSource: "cdip_sig",
      },
    });

    const result = processForecastHandoffBlendSlot({
      state,
      enabled: true,
      slot: {
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "1.0 ft",
        dataSource: "CDIP",
        waveHeightSource: "model_swell",
      },
    });

    expect(result.metric).toBeNull();
    expect(result.adjustment).toBeNull();
  });

  it("does not reuse a stale CDIP anchor after a CDIP-window model row", () => {
    const state = createForecastHandoffBlendState();
    processForecastHandoffBlendSlot({
      state,
      enabled: true,
      slot: {
        forecastAt: "2026-07-04T00:00:00Z",
        waveHeight: "4.0 ft",
        dataSource: "CDIP",
        waveHeightSource: "cdip_sig",
      },
    });
    processForecastHandoffBlendSlot({
      state,
      enabled: true,
      slot: {
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "1.0 ft",
        dataSource: "CDIP",
        waveHeightSource: "model_swell",
      },
    });

    const laterModel = processForecastHandoffBlendSlot({
      state,
      enabled: true,
      slot: {
        forecastAt: "2026-07-04T06:00:00Z",
        waveHeight: "1.0 ft",
        dataSource: "NOAA_NWS",
        waveHeightSource: "model_swell",
      },
    });

    expect(laterModel.metric).toBeNull();
    expect(laterModel.adjustment).toBeNull();
  });

  it("keeps default-off rows unchanged while still returning the seam metric", () => {
    const result = step({
      forecastAt: "2026-07-04T03:00:00Z",
      waveHeight: "1.0 ft",
      source: "model_swell",
      enabled: false,
    });

    expect(result.metric).toEqual(
      expect.objectContaining({
        handoffDiscontinuityFt: 3,
        rawRatio: 4,
        clampedRatio: 2,
      }),
    );
    expect(result.adjustment).toBeNull();
  });

  it("improves the Trestles CDIP-to-model seam with the clamped taper", () => {
    const state = createForecastHandoffBlendState();
    processForecastHandoffBlendSlot({
      state,
      enabled: true,
      slot: {
        forecastAt: "2026-07-04T00:00:00Z",
        waveHeight: "5.3 ft",
        dataSource: "CDIP",
        waveHeightSource: "cdip_sig",
      },
    });

    const firstModel = processForecastHandoffBlendSlot({
      state,
      enabled: true,
      slot: {
        forecastAt: "2026-07-04T03:00:00Z",
        waveHeight: "1.2 ft",
        dataSource: "NOAA_NWS",
        waveHeightSource: "model_swell",
      },
    });
    const nextDay = processForecastHandoffBlendSlot({
      state,
      enabled: true,
      slot: {
        forecastAt: "2026-07-05T03:00:00Z",
        waveHeight: "1.4 ft",
        dataSource: "NOAA_NWS",
        waveHeightSource: "model_swell",
      },
    });

    expect(firstModel.metric).toEqual(
      expect.objectContaining({
        handoffDiscontinuityFt: 4.1,
        rawRatio: 4.417,
        clampedRatio: 2,
      }),
    );
    expect(firstModel.adjustment?.waveHeight).toBe("2.4 ft");
    expect(nextDay.adjustment?.metadata.taperFactor).toBe(1.5);
    expect(nextDay.adjustment?.waveHeight).toBe("2.1 ft");
  });
});
