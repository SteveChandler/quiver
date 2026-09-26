import {
  GATE_COVERAGE,
  groupByStationMonth,
  overallCoverage,
  selectStationMonths,
  type ValuePicker,
} from "./coverage";
import { haversineKm } from "./geo";
import { localize } from "./hourly";
import { BUOY_SCORE_VERSION, scoreMonth } from "./score";
import type { CityClimatologyConfig, ClimatologySourceConfig } from "./sources";
import { classifyWind, waterMonthStats, waveMonthStats, WIND_BLOCKS, windMonthStats } from "./stats";
import type {
  ClimatologyMonth,
  ClimatologyRole,
  ClimatologyStation,
  HourlyObservation,
  LocalHourObservation,
  SurfClimatologyDataset,
} from "./types";

export const SEA_BREEZE_MIN_LIFT = 0.2;

export interface SourceSeries {
  source: ClimatologySourceConfig;
  hourly: HourlyObservation[];
}

interface PreparedSource {
  source: ClimatologySourceConfig;
  groups: Map<string, LocalHourObservation[]>;
  station: ClimatologyStation;
}

const pickWave: ValuePicker = (o) => o.waveHeightM;
const pickWater: ValuePicker = (o) => o.waterTempC;
const pickWind: ValuePicker = (o) => o.windSpeedKt;

function onshoreShare(obs: LocalHourObservation[], hours: readonly number[], shoreNormalDeg: number): number {
  const classes = obs
    .filter((o) => hours.includes(o.hour))
    .flatMap((o) => {
      const windClass = classifyWind(o.windDirDeg, o.windSpeedKt, shoreNormalDeg);
      return windClass === null ? [] : [windClass];
    });
  if (classes.length === 0) return 0;
  return classes.filter((windClass) => windClass === "onshore").length / classes.length;
}

/** Summer afternoon onshore share minus summer dawn onshore share. */
export function seaBreezeLift(obs: LocalHourObservation[], shoreNormalDeg: number): number {
  const summer = obs.filter((o) => o.month >= 6 && o.month <= 8);
  return (
    onshoreShare(summer, WIND_BLOCKS.afternoon, shoreNormalDeg) -
    onshoreShare(summer, WIND_BLOCKS.dawn, shoreNormalDeg)
  );
}

function prepare(series: SourceSeries, city: CityClimatologyConfig): PreparedSource {
  const { source } = series;
  const local = localize(series.hourly, city.timezone).filter(
    (o) => o.year >= source.years[0] && o.year <= source.years[1],
  );
  const pick = source.role === "wind" ? pickWind : pickWave;
  const gateCoverage = overallCoverage(local, source.years, pick);

  let passed = gateCoverage >= GATE_COVERAGE;
  if (source.role === "wind") {
    if (city.shoreNormalDeg === null) {
      throw new Error(`${city.citySlug} has a wind source but no shore normal`);
    }
    passed = passed && seaBreezeLift(local, city.shoreNormalDeg) >= SEA_BREEZE_MIN_LIFT;
  }

  const groups = groupByStationMonth(local, source.years);
  const excluded: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    excluded.push(...selectStationMonths(groups, month, source.years, pick).excluded);
  }

  return {
    source,
    groups,
    station: {
      id: source.id,
      alias: source.alias,
      name: source.name,
      role: source.role,
      kind: source.kind,
      lat: source.lat,
      lon: source.lon,
      distanceKm: Math.round(haversineKm(source, city.reference) * 10) / 10,
      referenceLabel: city.reference.label,
      yearsUsed: [source.years[0], source.years[1]],
      pageUrl: source.pageUrl,
      gate: passed ? "passed" : "failed",
      gateCoverage: Math.round(gateCoverage * 1000) / 1000,
      validHours: local.filter((o) => pick(o) !== null).length,
      excludedStationMonths: excluded.sort(),
    },
  };
}

export function buildSurfClimatologyDataset({
  city,
  series,
  generatedAt,
}: {
  city: CityClimatologyConfig;
  series: SourceSeries[];
  generatedAt: string;
}): SurfClimatologyDataset {
  const prepared = series.map((entry) => prepare(entry, city));
  const byRole = (role: ClimatologyRole): PreparedSource | null =>
    prepared.find((entry) => entry.source.role === role) ?? null;
  const passing = (entry: PreparedSource | null): PreparedSource | null =>
    entry && entry.station.gate === "passed" ? entry : null;

  const primary = byRole("waves");
  if (!primary) throw new Error(`${city.citySlug} has no wave source`);
  if (primary.station.gate === "failed") {
    throw new Error(
      `${city.citySlug}: ${primary.source.id} failed its coverage gate (${primary.station.gateCoverage})`,
    );
  }
  const comparison = passing(byRole("comparison-waves"));
  const wind = passing(byRole("wind"));

  const months: ClimatologyMonth[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const qualifying = (entry: PreparedSource, pick: ValuePicker) =>
      selectStationMonths(entry.groups, month, entry.source.years, pick).qualifying;
    const entry: Omit<ClimatologyMonth, "score"> = {
      month,
      waves: waveMonthStats(qualifying(primary, pickWave)),
      comparisonWaves: comparison ? waveMonthStats(qualifying(comparison, pickWave)) : null,
      water: waterMonthStats(qualifying(primary, pickWater)),
      wind:
        wind && city.shoreNormalDeg !== null
          ? windMonthStats(qualifying(wind, pickWind), city.shoreNormalDeg)
          : null,
    };
    months.push({ ...entry, score: scoreMonth(entry, wind !== null) });
  }

  return {
    schemaVersion: 1,
    scoreVersion: BUOY_SCORE_VERSION,
    citySlug: city.citySlug,
    cityName: city.cityName,
    generatedAt,
    timezone: city.timezone,
    shoreNormalDeg: city.shoreNormalDeg,
    reference: city.reference,
    places: city.places,
    stations: prepared.map((entry) => entry.station),
    months,
  };
}
