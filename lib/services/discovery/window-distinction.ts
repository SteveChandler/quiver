import type { BoardClass } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import {
  scoreWindowConditionScore,
  scoreWindowWithComposite,
} from './window-selector/window-scorer';

const AXIS_MARGIN = 12;
const AXIS_GOOD = 60;
const OVERALL_MARGIN = 10;
const UNIFORM_BAND = 8;
const MAX_WINDOWS = 16;

type AxisKey = 'windQuality' | 'tideFit' | 'baseConditions';

interface WindowAxisScores {
  forecast: EnhancedForecastEntity;
  axes: Record<AxisKey, number>;
  overall: number;
}

const AXES: readonly AxisKey[] = [
  'windQuality',
  'tideFit',
  'baseConditions',
];

const AXIS_REASONS: Record<AxisKey, string> = {
  windQuality: 'Cleanest wind of the day',
  tideFit: 'Best tide of the day',
  baseConditions: 'Best surf of the day',
};

export function computeWindowDistinctionReason(
  selected: EnhancedForecastEntity,
  dayWindows: EnhancedForecastEntity[],
  beach: Beach,
  timezone: string,
  skillLevel?: SkillLevel | string | null,
  boardClasses: readonly BoardClass[] = [],
): string | null {
  const comparisonSet = buildComparisonSet(selected, dayWindows, timezone);
  if (comparisonSet.length < 2) {
    return null;
  }

  const scoredWindows = comparisonSet.map((forecast) =>
    scoreWindowAxes(forecast, beach, skillLevel, boardClasses)
  );
  const selectedScore = scoredWindows.find(
    ({ forecast }) => forecast.forecast_at === selected.forecast_at
  );
  const otherScores = scoredWindows.filter(
    ({ forecast }) => forecast.forecast_at !== selected.forecast_at
  );

  if (!selectedScore || otherScores.length === 0) {
    return null;
  }

  const leadingAxes = AXES.filter((axis) => {
    const bestOtherAxis = Math.max(
      ...otherScores.map(({ axes }) => axes[axis])
    );
    return (
      selectedScore.axes[axis] >= bestOtherAxis + AXIS_MARGIN &&
      selectedScore.axes[axis] >= AXIS_GOOD
    );
  });

  if (leadingAxes.length === 1) {
    return AXIS_REASONS[leadingAxes[0]];
  }

  const bestOtherOverall = Math.max(
    ...otherScores.map(({ overall }) => overall)
  );
  const bestOverall = Math.max(...scoredWindows.map(({ overall }) => overall));
  if (
    selectedScore.overall === bestOverall &&
    selectedScore.overall >= bestOtherOverall + OVERALL_MARGIN
  ) {
    return 'Best window of the day';
  }

  const isUniformDay = AXES.every((axis) => {
    const values = scoredWindows.map(({ axes }) => axes[axis]);
    return Math.max(...values) - Math.min(...values) <= UNIFORM_BAND;
  });

  if (isUniformDay) {
    return 'Conditions hold steady all day';
  }

  return null;
}

function buildComparisonSet(
  selected: EnhancedForecastEntity,
  dayWindows: EnhancedForecastEntity[],
  timezone: string,
): EnhancedForecastEntity[] {
  const selectedLocalDay = getLocalCalendarDay(selected.forecast_at, timezone);
  if (!selectedLocalDay) {
    return [];
  }

  const sameDayWindows = dayWindows
    .filter(
      (window) =>
        getLocalCalendarDay(window.forecast_at, timezone) === selectedLocalDay
    )
    .sort(compareForecastAt);

  const selectedInDayWindows = sameDayWindows.some(
    (window) => window.forecast_at === selected.forecast_at
  );
  const sortedWindows = selectedInDayWindows
    ? sameDayWindows
    : [...sameDayWindows, selected].sort(compareForecastAt);
  const selectedIndex = sortedWindows.findIndex(
    (window) => window.forecast_at === selected.forecast_at
  );

  if (sortedWindows.length <= MAX_WINDOWS) {
    return sortedWindows;
  }

  if (selectedIndex >= 0 && selectedIndex >= MAX_WINDOWS) {
    return [
      ...sortedWindows.slice(0, MAX_WINDOWS - 1),
      selected,
    ].sort(compareForecastAt);
  }

  return sortedWindows.slice(0, MAX_WINDOWS);
}

function scoreWindowAxes(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  skillLevel?: SkillLevel | string | null,
  boardClasses: readonly BoardClass[] = [],
): WindowAxisScores {
  const composite = scoreWindowWithComposite(forecast, beach);

  return {
    forecast,
    axes: {
      windQuality: composite.subscores.get('windQuality') ?? 0,
      tideFit: composite.subscores.get('tideFit') ?? 0,
      baseConditions: composite.subscores.get('baseConditions') ?? 0,
    },
    overall: scoreWindowConditionScore(forecast, beach, skillLevel, null, boardClasses),
  };
}

function getLocalCalendarDay(
  isoTimestamp: string,
  timezone: string,
): string | null {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function compareForecastAt(
  a: EnhancedForecastEntity,
  b: EnhancedForecastEntity,
): number {
  return Date.parse(a.forecast_at) - Date.parse(b.forecast_at);
}
