import { angleDifference } from "@/lib/domains/shared";
import { cardinalToDegrees } from "@/lib/services/forecast/forecast-transformer";

const METERS_TO_FEET = 3.28084;

type DisplaySwellRow = {
  data_source?: string | null;
  wave_height?: string | null;
  wave_period?: string | null;
  wave_direction?: string | null;
  wave_direction_om?: number | string | null;
  swell_1_height?: string | null;
  swell_1_period?: string | null;
  swell_1_direction?: string | null;
  swell_height_om?: number | null;
  swell_period_om?: number | null;
  swell_direction_om?: number | null;
};

export interface DisplaySwellWindow {
  centerDeg: number;
  halfwidthDeg: number;
}

export interface DisplaySwell {
  periodSeconds: number | null;
  directionDeg: number | null;
  heightFt: number | null;
  source: "partition" | "offshore";
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isInWindow(directionDeg: number | null, window: DisplaySwellWindow): boolean {
  return directionDeg !== null
    && angleDifference(directionDeg, window.centerDeg) <= window.halfwidthDeg;
}

export function resolveDisplaySwell(
  row: DisplaySwellRow | null,
  window: DisplaySwellWindow | null,
): DisplaySwell {
  const namedPeriod = parseNumber(row?.swell_1_period ?? row?.wave_period);
  const namedDirection = cardinalToDegrees(
    row?.swell_1_direction ?? row?.wave_direction,
  );
  const namedHeight = parseNumber(row?.swell_1_height ?? row?.wave_height);
  const waveDirectionOm = cardinalToDegrees(row?.wave_direction_om);
  const offshoreDirection = parseNumber(row?.swell_direction_om);
  const offshorePeriod = parseNumber(row?.swell_period_om);
  const offshoreIsDisplayCandidate = Boolean(
    window
    && offshoreDirection !== null
    && offshorePeriod !== null
    && isInWindow(offshoreDirection, window)
    && !isInWindow(namedDirection, window),
  );

  if (
    row?.data_source === "CDIP"
    && waveDirectionOm !== null
    && (
      namedDirection === null
      || angleDifference(waveDirectionOm, namedDirection) >= 45
      || (
        offshoreIsDisplayCandidate
        && offshoreDirection !== null
        && angleDifference(waveDirectionOm, offshoreDirection) >= 45
      )
    )
  ) {
    return {
      periodSeconds: namedPeriod,
      directionDeg: waveDirectionOm,
      heightFt: namedHeight,
      source: "partition",
    };
  }

  if (offshoreIsDisplayCandidate && offshoreDirection !== null && offshorePeriod !== null) {
    const offshoreHeightMeters = parseNumber(row?.swell_height_om);
    return {
      periodSeconds: offshorePeriod,
      directionDeg: offshoreDirection,
      heightFt:
        offshoreHeightMeters === null ? null : offshoreHeightMeters * METERS_TO_FEET,
      source: "offshore",
    };
  }

  return {
    periodSeconds: namedPeriod,
    directionDeg: namedDirection,
    heightFt: namedHeight,
    source: "partition",
  };
}
