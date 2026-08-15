import type { Beach } from "@/types/database";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import { formatBeachDateTime, formatTimeInTimezone } from "@/lib/utils/date-time";
import { isDataStale } from "@/lib/utils/forecast-client-utils";

interface PublicForecastAnswerProps {
  beach: Beach;
  report: SurfCallResult | null;
  context: ForecastRecommendationContext | null;
  isTomorrow: boolean;
  headingLevel: "h1" | "h2";
}

function formatForecastDate(
  localDate: string | null | undefined,
  timezone: string,
): string | null {
  if (!localDate) return null;
  const date = new Date(`${localDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

function formatRange(
  start: string | null | undefined,
  end: string | null | undefined,
  timezone: string,
): string | null {
  if (!start || !end) return null;
  const startLabel = formatTimeInTimezone(start, timezone);
  const endLabel = formatTimeInTimezone(end, timezone);
  if (!startLabel || !endLabel) return null;
  return `${startLabel}–${endLabel}`;
}

function joinParts(parts: Array<string | null | undefined>): string | null {
  const filtered = parts.filter((part): part is string => Boolean(part?.trim()));
  return filtered.length > 0 ? filtered.join(" ") : null;
}

function buildSwell(
  height: string | null | undefined,
  period: string | null | undefined,
  direction: string | null | undefined,
): string | null {
  if (!height && !period && !direction) return null;
  const heightLabel = height ? `${height}` : null;
  const periodLabel = period ? `@ ${period}` : null;
  return joinParts([heightLabel, periodLabel, direction]);
}

function sourceLabel(source: string): string {
  switch (source) {
    case "NOAA_CO-OPS":
      return "NOAA CO-OPS";
    case "NOAA_NWS":
      return "NOAA NWS";
    case "OPEN_METEO":
      return "Open-Meteo";
    default:
      return source.replaceAll("_", " ");
  }
}

export function PublicForecastAnswer({
  beach,
  report,
  context,
  isTomorrow,
  headingLevel,
}: PublicForecastAnswerProps) {
  const timezone =
    context?.timezone ??
    (beach as { timezone?: string | null }).timezone ??
    "UTC";
  const forecastDate = formatForecastDate(context?.localDate, timezone);
  const waveHeight = context?.waveHeightRangeLabel ?? context?.waveHeight ?? report?.waveHeight;
  const bestWindow = formatRange(
    context?.displayWindowStart ?? report?.bestWindowStart,
    context?.displayWindowEnd ?? report?.bestWindowEnd,
    timezone,
  );
  const primarySwell = buildSwell(
    context?.primarySwellHeight,
    context?.swellPeriod,
    context?.swellDirection,
  );
  const secondarySwell = buildSwell(
    context?.secondarySwellHeight,
    context?.secondarySwellPeriod,
    context?.secondarySwellDirection,
  );
  const wind = joinParts([
    context?.windSpeed ?? report?.windSpeed,
    context?.windDirection ?? report?.windCompass,
    report?.windType,
  ]);
  const tide = joinParts([
    report?.tideHeight,
    report?.tidePhase,
    report?.nextTideType ? `next ${report.nextTideType.toLowerCase()}` : null,
  ]);
  const sourceDataUpdatedAt = context?.sourceDataUpdatedAt ?? null;
  const primaryDataSource = context?.primaryDataSource ?? null;
  const isStale = sourceDataUpdatedAt
    ? isDataStale(sourceDataUpdatedAt, primaryDataSource)
    : false;
  const titleDate = forecastDate ? ` for ${forecastDate}` : "";
  const validAt = context?.selectedRowTime
    ? formatBeachDateTime(context.selectedRowTime, timezone, "EEE h:mm a")
    : null;
  const sourceUpdatedAt = sourceDataUpdatedAt
    ? formatBeachDateTime(sourceDataUpdatedAt, timezone, "EEE h:mm a")
    : null;
  const computedAt = report?.updatedAt
    ? formatBeachDateTime(report.updatedAt, timezone, "EEE h:mm a")
    : null;
  const HeadingTag = headingLevel;
  const hasForecastDetails = Boolean(context?.selectedRowTime && waveHeight);

  return (
    <section
      aria-labelledby="public-forecast-answer-heading"
      data-testid="public-forecast-answer"
      className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8"
    >
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {isTomorrow ? "Tomorrow's surf forecast" : "Surf forecast"}
        </p>
        <HeadingTag id="public-forecast-answer-heading" className="mt-2 text-xl font-semibold text-foreground">
          {beach.name} Surf Forecast{titleDate}
        </HeadingTag>

        {hasForecastDetails ? (
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {waveHeight && <div><dt className="font-medium text-muted-foreground">Surf</dt><dd>{waveHeight}</dd></div>}
            {bestWindow && <div><dt className="font-medium text-muted-foreground">Best window</dt><dd>{bestWindow}</dd></div>}
            {report?.verdict && <div><dt className="font-medium text-muted-foreground">Verdict</dt><dd>{report.verdict}</dd></div>}
            {report?.score != null && <div><dt className="font-medium text-muted-foreground">Score</dt><dd>{report.score}/100</dd></div>}
            {report?.forecastConfidence != null && <div><dt className="font-medium text-muted-foreground">Confidence</dt><dd>{report.forecastConfidence}/100</dd></div>}
            {primarySwell && <div><dt className="font-medium text-muted-foreground">Primary swell</dt><dd>{primarySwell}</dd></div>}
            {secondarySwell && <div><dt className="font-medium text-muted-foreground">Secondary swell</dt><dd>{secondarySwell}</dd></div>}
            {wind && <div><dt className="font-medium text-muted-foreground">Wind</dt><dd>{wind}</dd></div>}
            {tide && <div><dt className="font-medium text-muted-foreground">Tide</dt><dd>{tide}</dd></div>}
          </dl>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Current forecast details are temporarily unavailable. Check back for the next Quiver surf call and hourly conditions.
          </p>
        )}

        {report?.whySentence && (
          <p className="mt-5 text-sm leading-6 text-foreground">
            <strong>Why:</strong> {report.whySentence}
          </p>
        )}

        {(validAt || sourceUpdatedAt || computedAt) && <div className="mt-5 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
          {validAt && <p>
            Forecast valid at {validAt} ({timezone}).
            {isStale ? " Source data is stale; conditions may have changed." : ""}
          </p>}
          {sourceUpdatedAt && <p>Source data updated: {sourceUpdatedAt}.</p>}
          {computedAt && <p>Quiver computed this answer: {computedAt}.</p>}
          {context?.contributingSources && context.contributingSources.length > 0 && (
            <p>Contributing sources: {context.contributingSources.map(sourceLabel).join(", ")}.</p>
          )}
        </div>}
      </div>
    </section>
  );
}
