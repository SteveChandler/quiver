export interface DayScore {
  localDate: string;
  bestScore: number;
  go: boolean;
}

export interface RarityVerdict {
  rare: boolean;
  kind: "best-in-30" | "first-after-flat" | null;
  rarityLine: string | null;
}

const FLAT_SCORE_CEILING = 39;
const MIN_FLAT_DAYS = 3;
const HISTORY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(localDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${localDate}T12:00:00.000Z`));
}

function shiftDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function assessRarity(args: {
  peakDate: string;
  history: DayScore[];
  peakScore: number;
  peakGo: boolean;
}): RarityVerdict {
  if (!args.peakGo) {
    return { rare: false, kind: null, rarityLine: null };
  }

  const history = args.history
    .filter((day) => day.localDate < args.peakDate)
    .sort((left, right) => left.localDate.localeCompare(right.localDate))
    .slice(-HISTORY_DAYS);
  let flatDays = 0;
  let expectedDate = shiftDate(args.peakDate, -1);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (
      history[index].localDate !== expectedDate
      || history[index].bestScore > FLAT_SCORE_CEILING
    ) {
      break;
    }
    flatDays += 1;
    expectedDate = shiftDate(expectedDate, -1);
  }

  if (flatDays >= MIN_FLAT_DAYS) {
    return {
      rare: true,
      kind: "first-after-flat",
      rarityLine: `First real swell in ${flatDays + 1} days`,
    };
  }

  const previousBest = Math.max(
    ...history.map((day) => day.bestScore),
    Number.NEGATIVE_INFINITY,
  );
  if (history.length === 0 || args.peakScore <= previousBest) {
    return { rare: false, kind: null, rarityLine: null };
  }

  const previousGo = [...history].reverse().find((day) => day.go);
  return {
    rare: true,
    kind: "best-in-30",
    rarityLine: previousGo
      ? `Best since ${formatDate(previousGo.localDate)}`
      : "Best in 30 days",
  };
}

export function buildEventKey(args: {
  peakDate: string;
  leadBeachId: string;
}): string {
  const peakDate = new Date(`${args.peakDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(args.peakDate)
    || !Number.isFinite(peakDate.getTime())
    || peakDate.toISOString().slice(0, 10) !== args.peakDate
  ) {
    throw new TypeError("peakDate must be a valid YYYY-MM-DD date");
  }
  if (!args.leadBeachId) {
    throw new TypeError("leadBeachId is required");
  }

  const ordinal = Math.floor(peakDate.getTime() / DAY_MS);
  const bucketStart = new Date((ordinal - (ordinal % 2)) * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return `${args.leadBeachId}:${bucketStart}`;
}
