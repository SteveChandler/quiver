import { countryName, usRegionName } from "./geography";
import {
  classifyTideTypeFromConstituents,
  classifyTideTypeFromExtremes,
  metresToFeet,
  summarizeRange,
  type TideExtremePoint,
  type TideTypeResult,
} from "./series";
import type { TideStationRow } from "./types";

export function stationPlaceLabel(station: Pick<TideStationRow, "country_code" | "region">): string {
  if (station.country_code === "US" && station.region) return usRegionName(station.region);
  return countryName(station.country_code);
}

const NAMES_WITH_THE = new Set(["Netherlands", "Philippines", "Bahamas", "Maldives", "Gambia", "Dominican Republic"]);

/** "the United Kingdom", "the Marshall Islands", "Japan": for "in {place}" sentences. */
function placeInSentence(place: string): string {
  const needsThe = place.startsWith("United ") || place.endsWith(" Islands") || NAMES_WITH_THE.has(place);
  return needsThe ? `the ${place}` : place;
}

export function stationTideType(
  station: Pick<TideStationRow, "constituents">,
  extremes: TideExtremePoint[]
): TideTypeResult | null {
  if (station.constituents?.length) return classifyTideTypeFromConstituents(station.constituents);
  return classifyTideTypeFromExtremes(extremes);
}

const TIDE_TYPE_SENTENCE: Record<TideTypeResult["type"], string> = {
  semidiurnal: "Semidiurnal: two highs and two lows a day, close to the same size.",
  "mixed-semidiurnal": "Mixed, mostly semidiurnal: two highs and two lows a day, one pair noticeably bigger than the other.",
  "mixed-diurnal": "Mixed, mostly diurnal: some days bring one big high and one deep low, others a small second tide.",
  diurnal: "Diurnal: one high and one low most days.",
};

export function tideTypeLabel(type: TideTypeResult["type"]): string {
  switch (type) {
    case "semidiurnal":
      return "Semidiurnal";
    case "mixed-semidiurnal":
      return "Mixed, mostly semidiurnal";
    case "mixed-diurnal":
      return "Mixed, mostly diurnal";
    case "diurnal":
      return "Diurnal";
  }
}

const ft = (m: number): string => `${metresToFeet(m).toFixed(1)} ft`;

/** Spring and neap ranges from the main lunar and solar constituents. */
function springNeapRangesM(station: Pick<TideStationRow, "constituents">): { springM: number; neapM: number } | null {
  const amp = (name: string): number =>
    station.constituents?.find((c) => c.name.toUpperCase() === name)?.amplitudeM ?? 0;
  const m2 = amp("M2");
  const s2 = amp("S2");
  if (m2 <= 0) return null;
  return { springM: 2 * (m2 + s2), neapM: 2 * Math.abs(m2 - s2) };
}

interface StationCopyInput {
  station: TideStationRow;
  extremes: TideExtremePoint[];
  tideType: TideTypeResult | null;
  nearestBeach?: { name: string; distanceKm: number } | null;
  referenceStationName?: string | null;
  /** Feet Quiver adds to NOAA's table (California sea-level adjustment), 0 when none. */
  adjustmentFt?: number;
}

/**
 * Short explanatory paragraphs built only from this station's own facts, so no
 * two stations read the same unless their tides really are the same.
 */
export function buildStationCopy({
  station,
  extremes,
  tideType,
  nearestBeach,
  referenceStationName,
  adjustmentFt = 0,
}: StationCopyInput): string[] {
  const place = placeInSentence(stationPlaceLabel(station));
  const paragraphs: string[] = [];

  if (station.source === "noaa") {
    const kind =
      station.station_kind === "reference"
        ? `a NOAA reference station in ${place}, with its own harmonic constants`
        : `a NOAA subordinate station in ${place}: its highs and lows are offsets from ${referenceStationName ?? `reference station ${station.reference_station_id ?? "nearby"}`}`;
    const datum =
      adjustmentFt !== 0
        ? `feet above mean lower low water (MLLW), plus Quiver's +${adjustmentFt.toFixed(1)} ft California sea-level adjustment`
        : "feet above mean lower low water (MLLW)";
    paragraphs.push(`${station.name} is ${kind}. Heights are ${datum}.`);
  } else {
    paragraphs.push(
      `${station.name} is a tide gauge in ${place}, run by ${station.operator}. Quiver computes these tides from the gauge's TICON-4 harmonic constants. Heights are feet above a computed mean lower low water, not a published chart datum.`
    );
  }

  if (tideType) {
    const factor = tideType.formFactor != null ? ` (form factor ${tideType.formFactor.toFixed(2)})` : "";
    paragraphs.push(`Tide type${factor}: ${TIDE_TYPE_SENTENCE[tideType.type]}`);
  }

  const range = summarizeRange(extremes);
  if (range) {
    const springNeap = springNeapRangesM(station);
    const springNeapText = springNeap
      ? ` Typical spring tides swing about ${ft(springNeap.springM)}; neaps about ${ft(springNeap.neapM)}.`
      : "";
    paragraphs.push(
      `This week the biggest swing between high and low is ${ft(range.maxRangeM)}; the average swing is ${ft(range.meanRangeM)}.${springNeapText}`
    );
  }

  if (nearestBeach) {
    paragraphs.push(`Closest Quiver spot: ${nearestBeach.name}, ${Math.round(nearestBeach.distanceKm)} km away.`);
  }

  return paragraphs;
}
