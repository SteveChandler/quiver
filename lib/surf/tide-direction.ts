type TideDirection = "rising" | "falling" | "slack";
type TidePreference = "rising" | "falling" | "slack" | "either";

export interface TideAlert {
  status: "optimal" | "waiting" | "neutral";
  message: string;
}

/** A beach's preferred tide height band (beaches.preferred_tide_ft_min / _max). */
export interface TideRangeFt {
  minFt: number;
  maxFt: number;
}

export interface TideHeightContext {
  range: TideRangeFt | null;
  /** Tide height now, on the same curve as the tide chart. */
  heightFt: number | null;
  /** When direction and height are next both good, e.g. "Sun 2:50 AM". Null when not within 24 h. */
  nextGoodLabel: string | null;
}

/** In range at the precision the page prints the height (one decimal), so "1.0 ft" never reads as below 1.0. */
export function isTideHeightInRange(heightFt: number, range: TideRangeFt): boolean {
  const shown = Math.round(heightFt * 10) / 10;
  return shown >= range.minFt && shown <= range.maxFt;
}

const ft = (value: number): string => `${value.toFixed(1)} ft`;
const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Generates an alert message from the tide direction and, when the beach has a
 * preferred height range, the tide height. "Optimal" needs both to be good.
 */
export function getTideAlert(
  beachPref: TidePreference | string | null,
  currentDir: TideDirection | null,
  minutesToChange: number | null,
  height?: TideHeightContext | null
): TideAlert {
  const range = height?.range ?? null;
  if (range) return getRangedTideAlert(beachPref, currentDir, range, height!);

  if (!beachPref || beachPref === "either") {
    return { status: "neutral", message: "Good on any tide" };
  }

  if (!currentDir) {
    return { status: "neutral", message: "Tide data unavailable" };
  }

  if (beachPref === currentDir) {
    return {
      status: "optimal",
      message: `Optimal now – tide is ${currentDir}`,
    };
  }

  const hours = minutesToChange ? Math.round(minutesToChange / 60) : null;
  const timeStr = hours !== null ? (hours > 0 ? `in ${hours}h` : "soon") : "";

  return {
    status: "waiting",
    message: `Better ${timeStr} (${beachPref} tide)`.trim(),
  };
}

function getRangedTideAlert(
  beachPref: TidePreference | string | null,
  currentDir: TideDirection | null,
  range: TideRangeFt,
  { heightFt, nextGoodLabel }: TideHeightContext
): TideAlert {
  const wantDirection = beachPref && beachPref !== "either" ? beachPref : null;
  const rangeText = `${range.minFt.toFixed(1)}–${ft(range.maxFt)}`;
  const likes = wantDirection ? `${rangeText}, ${wantDirection}` : rangeText;

  if (wantDirection && !currentDir) {
    return { status: "neutral", message: "Tide data unavailable" };
  }

  if (heightFt == null || !Number.isFinite(heightFt)) {
    const message = currentDir && wantDirection
      ? `Tide is ${currentDir} – this spot likes ${rangeText}`
      : `This spot likes ${rangeText}`;
    return { status: "neutral", message };
  }

  const shown = Math.round(heightFt * 10) / 10;
  const inRange = isTideHeightInRange(heightFt, range);
  const directionOk = !wantDirection || wantDirection === currentDir;

  if (inRange && directionOk) {
    const message = wantDirection ? `Optimal now – ${currentDir}, ${ft(shown)}` : `Optimal now – ${ft(shown)}`;
    return { status: "optimal", message };
  }

  const reason = !inRange
    ? `${shown < range.minFt ? "Too low" : "Too high"} at ${ft(shown)}`
    : `${capitalize(currentDir!)} now`;
  const message = nextGoodLabel
    ? `${reason} – good from ${nextGoodLabel} (${likes})`
    : `${reason} – this spot likes ${likes}`;
  return { status: "waiting", message };
}
