/**
 * @jest-environment node
 */

import {
  buildSouthOcSanoShadowZoneSnapshot,
  fetchSouthOcSanoShadowZoneSnapshot,
  resolveSouthOcSanoShadowGuardrail,
  SOUTH_OC_SANO_SHADOW_GUARDRAIL_FEATURE_FLAG,
} from "@/lib/services/forecast/south-oc-sano-shadow-guardrail";
import type { Beach } from "@/types/database";

const NOW_MS = Date.parse("2026-06-02T16:30:00Z");

function observedAt(minutesAgo: number): string {
  return new Date(NOW_MS - minutesAgo * 60 * 1000).toISOString();
}

function makeObservation(overrides: {
  stationId: string;
  heightM?: number | null;
  periodS?: number | null;
  directionDeg?: number | null;
  minutesAgo?: number;
  source?: string | null;
  sourceNetwork?: string | null;
}) {
  return {
    station_id: overrides.stationId,
    observed_at: observedAt(overrides.minutesAgo ?? 30),
    wave_height_m: overrides.heightM === undefined ? 1.0 : overrides.heightM,
    wave_period_s: overrides.periodS === undefined ? 17 : overrides.periodS,
    wave_direction_deg: overrides.directionDeg === undefined ? 205 : overrides.directionDeg,
    source: overrides.source === undefined ? "ndbc_direct" : overrides.source,
    source_network: overrides.sourceNetwork === undefined ? "ndbc" : overrides.sourceNetwork,
  };
}

function makeBeach(slug: string, features: string[] = [SOUTH_OC_SANO_SHADOW_GUARDRAIL_FEATURE_FLAG]): Beach {
  return {
    id: `beach-${slug}`,
    slug,
    name: slug,
    lat: 33.4,
    lon: -117.6,
    center_lat: 33.4,
    center_lng: -117.6,
    features,
    timezone: "America/Los_Angeles",
  } as unknown as Beach;
}

describe("buildSouthOcSanoShadowZoneSnapshot", () => {
  test("uses the highest valid Red/Capistrano nearshore observation as confirmation", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46277", heightM: 1.0 }),
        makeObservation({ stationId: "46275", heightM: 0.95 }),
        makeObservation({ stationId: "46285", heightM: 1.1 }),
      ],
      NOW_MS,
    );

    expect(snapshot.confirmedNearshore?.stationId).toBe("46285");
    expect(snapshot.confirmedNearshore?.waveHeightM).toBe(1.1);
    expect(snapshot.offshoreContext?.stationId).toBe("46277");
  });

  test("rejects stale, invalid, and offshore-only observations", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46277", heightM: 1.2 }),
        makeObservation({ stationId: "46275", heightM: 1.0, minutesAgo: 91 }),
        makeObservation({ stationId: "46285", heightM: 1.0, sourceNetwork: null }),
      ],
      NOW_MS,
    );

    expect(snapshot.confirmedNearshore).toBeNull();
    expect(snapshot.offshoreContext?.stationId).toBe("46277");
  });

  test("rejects clear nearshore outliers against fresh Green Beach offshore context", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46277", heightM: 1.0 }),
        makeObservation({ stationId: "46275", heightM: 1.9 }),
      ],
      NOW_MS,
    );

    expect(snapshot.confirmedNearshore).toBeNull();
    expect(snapshot.rejectionReason).toBe("nearshore_outlier_vs_offshore");
  });

  test("rejects nearshore rows below the 3ft height threshold", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46275", heightM: 0.9 }),
        makeObservation({ stationId: "46285", heightM: 0.91 }),
      ],
      NOW_MS,
    );

    expect(snapshot.confirmedNearshore).toBeNull();
  });

  test("rejects nearshore rows below the 15s period threshold", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46275", heightM: 1.0, periodS: 14.9 }),
        makeObservation({ stationId: "46285", heightM: 1.0, periodS: 10 }),
      ],
      NOW_MS,
    );

    expect(snapshot.confirmedNearshore).toBeNull();
  });

  test("rejects nearshore rows outside the S/SSW direction window", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46275", heightM: 1.0, directionDeg: 174.9 }),
        makeObservation({ stationId: "46285", heightM: 1.0, directionDeg: 220.1 }),
      ],
      NOW_MS,
    );

    expect(snapshot.confirmedNearshore).toBeNull();
  });
});

describe("fetchSouthOcSanoShadowZoneSnapshot", () => {
  test("queries only fresh observation rows for the validation stations", async () => {
    const order = jest.fn(async () => ({ data: [], error: null }));
    const gte = jest.fn(() => ({ order }));
    const stationIn = jest.fn(() => ({ gte, order }));
    const select = jest.fn(() => ({ in: stationIn }));
    const from = jest.fn(() => ({ select }));
    const supabase = { from };

    await fetchSouthOcSanoShadowZoneSnapshot(supabase as never, NOW_MS);

    expect(from).toHaveBeenCalledWith("unified_wave_observations");
    expect(stationIn).toHaveBeenCalledWith("station_id", ["46277", "46275", "46285"]);
    expect(gte).toHaveBeenCalledWith(
      "observed_at",
      new Date(NOW_MS - 90 * 60 * 1000).toISOString(),
    );
    expect(order).toHaveBeenCalledWith("observed_at", { ascending: false });
  });
});

describe("resolveSouthOcSanoShadowGuardrail", () => {
  test("returns a calibrated Trestles anchor for flagged Trestles-cluster beaches", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46277", heightM: 1.0 }),
        makeObservation({ stationId: "46275", heightM: 0.96 }),
      ],
      NOW_MS,
    );

    const result = resolveSouthOcSanoShadowGuardrail({
      beach: makeBeach("lower-trestles"),
      snapshot,
      forecastAtMs: NOW_MS,
      nowMs: NOW_MS,
    });

    expect(result.kind).toBe("trestles_calibrated_anchor");
    if (result.kind !== "trestles_calibrated_anchor") throw new Error("expected Trestles guardrail");
    expect(result.anchor.stationId).toBe("46275");
    expect(result.anchor.allowCalibratedShoaling).toBe(true);
    expect(result.metadata.branch).toBe("trestles_calibrated_anchor");
  });

  test("applies to active confirmed nearshore south swell through now plus six hours", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46277", heightM: 1.0 }),
        makeObservation({ stationId: "46275", heightM: 0.96 }),
      ],
      NOW_MS,
    );

    const result = resolveSouthOcSanoShadowGuardrail({
      beach: makeBeach("lower-trestles"),
      snapshot,
      forecastAtMs: NOW_MS + 6 * 60 * 60 * 1000,
      nowMs: NOW_MS,
    });

    expect(result.kind).toBe("trestles_calibrated_anchor");
  });

  test("does not apply before now minus thirty minutes or after now plus six hours", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46277", heightM: 1.0 }),
        makeObservation({ stationId: "46275", heightM: 0.96 }),
      ],
      NOW_MS,
    );

    expect(
      resolveSouthOcSanoShadowGuardrail({
        beach: makeBeach("lower-trestles"),
        snapshot,
        forecastAtMs: NOW_MS - 31 * 60 * 1000,
        nowMs: NOW_MS,
      }),
    ).toMatchObject({ kind: "noop", reason: "outside_nowcast_window" });
    expect(
      resolveSouthOcSanoShadowGuardrail({
        beach: makeBeach("lower-trestles"),
        snapshot,
        forecastAtMs: NOW_MS + 6 * 60 * 60 * 1000 + 1,
        nowMs: NOW_MS,
      }),
    ).toMatchObject({ kind: "noop", reason: "outside_nowcast_window" });
  });

  test("returns a non-cluster anchor floor for flagged South OC beaches outside Trestles cluster", () => {
    const snapshot = buildSouthOcSanoShadowZoneSnapshot(
      [
        makeObservation({ stationId: "46277", heightM: 1.0 }),
        makeObservation({ stationId: "46285", heightM: 0.98 }),
      ],
      NOW_MS,
    );

    const result = resolveSouthOcSanoShadowGuardrail({
      beach: makeBeach("t-street"),
      snapshot,
      forecastAtMs: NOW_MS,
      nowMs: NOW_MS,
    });

    expect(result.kind).toBe("non_cluster_anchor_floor");
    if (result.kind !== "non_cluster_anchor_floor") throw new Error("expected non-cluster guardrail");
    expect(result.anchor.allowCalibratedShoaling).toBe(false);
    expect(result.metadata.branch).toBe("non_cluster_anchor_floor");
  });

  test("returns no-op when the beach is unflagged, out of zone, outside nowcast window, or lacks nearshore confirmation", () => {
    const confirmed = buildSouthOcSanoShadowZoneSnapshot(
      [makeObservation({ stationId: "46275", heightM: 1.0 })],
      NOW_MS,
    );
    const offshoreOnly = buildSouthOcSanoShadowZoneSnapshot(
      [makeObservation({ stationId: "46277", heightM: 1.0 })],
      NOW_MS,
    );

    expect(
      resolveSouthOcSanoShadowGuardrail({
        beach: makeBeach("lower-trestles", []),
        snapshot: confirmed,
        forecastAtMs: NOW_MS,
        nowMs: NOW_MS,
      }).kind,
    ).toBe("noop");
    expect(
      resolveSouthOcSanoShadowGuardrail({
        beach: makeBeach("blacks"),
        snapshot: confirmed,
        forecastAtMs: NOW_MS,
        nowMs: NOW_MS,
      }).kind,
    ).toBe("noop");
    expect(
      resolveSouthOcSanoShadowGuardrail({
        beach: makeBeach("lower-trestles"),
        snapshot: confirmed,
        forecastAtMs: NOW_MS + 7 * 60 * 60 * 1000,
        nowMs: NOW_MS,
      }).kind,
    ).toBe("noop");
    expect(
      resolveSouthOcSanoShadowGuardrail({
        beach: makeBeach("lower-trestles"),
        snapshot: offshoreOnly,
        forecastAtMs: NOW_MS,
        nowMs: NOW_MS,
      }).kind,
    ).toBe("noop");
  });
});
