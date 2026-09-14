import { gunzipSync } from "node:zlib";
import { swellWatchAttestedReplayGzipBase64 } from "@/__tests__/fixtures/swell-watch-attested-replay-20260910";
import waikiki from "@/__tests__/fixtures/swell-watch-retained-20260913/waikiki-20260913T1200Z.json";
import hatteras from "@/__tests__/fixtures/swell-watch-retained-20260913/hatteras-20260913T1200Z.json";
import type { loadAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/attested-run";
import type { SwellPartitionObservation } from "@/lib/alerts/swell-watch/partition-normalizer";

const historical = JSON.parse(gunzipSync(Buffer.from(swellWatchAttestedReplayGzipBase64, "base64")).toString()).rows[0].value as Array<{
  sourcePointId: string; latitude: number; longitude: number;
  beach: { swell_window_center_deg: number; swell_window_halfwidth_deg: number };
  run: Awaited<ReturnType<typeof loadAttestedSwellWatchRun>>;
}>;

export { waikiki, hatteras, historical };
export const sourceIdentity = { provider: "open_meteo", transportProvider: "open_meteo_single_runs",
  model: "ncep_gfswave016", upstreamModelProvider: "ncep", forecastDays: 7, issuedAt: waikiki.issuedAt };

export function retainedSeries(fixture: typeof waikiki | typeof hatteras): SwellPartitionObservation[][] {
  const hourly: Record<string, number[] | string[]> = fixture.semanticPayload.hourly;
  return hourly.time.map((_, index) => ["swell_wave_", "secondary_swell_wave_"].map((prefix, slot) => ({
    provider: "open_meteo", evaluationId: "genuine_completed:5a7ff0e2-b185-4488-8128-bff98dfd3f64",
    sourceSlot: slot === 0 ? "s1" : "s2", forecastAt: new Date(Date.parse(fixture.issuedAt) + index * 3_600_000).toISOString(),
    heightM: hourly[`${prefix}height`][index] as number, periodS: hourly[`${prefix}period`][index] as number,
    directionDeg: (hourly[`${prefix}direction`][index] as number) % 360, completeness: "complete",
  })));
}

export function retainedRun(fixture: typeof waikiki | typeof hatteras) {
  return { source: { ...sourceIdentity, sourcePointId: fixture.sourcePointId,
    providerBatchId: "7aec200e-f952-4f81-bde9-cb5706845073", revisionSetId: fixture.revisionSetId,
    // The retained payload does not carry issuance identity; this UUID is a replay-only reader fixture.
    issuanceId: "11111111-1111-4111-8111-111111111111", evaluationId: retainedSeries(fixture)[0][0].evaluationId },
  forecastDays: 7, selectedGrid: {}, samples: retainedSeries(fixture).map((frame) => ({ forecastAt: frame[0].forecastAt,
    components: frame.map((part) => ({ ...part, rawFieldProvenance: {}, timeProvenance: {},
      ...(part.heightM === 0 && part.periodS === 0 && part.directionDeg === 0 ? { unavailableReason: "provider_zero_tuple" } : {}) })),
  })) };
}
