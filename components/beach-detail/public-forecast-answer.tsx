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
      className="border-2 border-[#11100D] bg-[#FFFDF4] px-5 py-5 shadow-[3px_4px_0_rgba(17,16,13,0.2)] sm:px-6"
    >
      <p className="typewriter font-bold text-[#0B3A75]">
        {isTomorrow ? "Tomorrow's surf forecast" : "Surf forecast"}
      </p>
      <HeadingTag
        id="public-forecast-answer-heading"
        className="mt-2 font-[var(--font-zine-display)] text-2xl uppercase leading-tight text-[#11100D] sm:text-3xl"
      >
        {beach.name} Surf Forecast{titleDate}
      </HeadingTag>

      {hasForecastDetails ? (
        <dl className="mt-5 grid gap-x-6 gap-y-4 border-t-2 border-dashed border-[#0B3A75]/30 pt-4 font-mono text-sm text-[#11100D] sm:grid-cols-2 lg:grid-cols-3">
          {waveHeight && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Surf</dt><dd className="mt-0.5 text-base font-bold">{waveHeight}</dd></div>}
          {bestWindow && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Best window</dt><dd className="mt-0.5 text-base font-bold">{bestWindow}</dd></div>}
          {report?.verdict && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Verdict</dt><dd className="mt-0.5 text-base font-bold">{report.verdict}</dd></div>}
          {report?.score != null && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Score</dt><dd className="mt-0.5 text-base font-bold">{report.score}/100</dd></div>}
          {report?.forecastConfidence != null && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Confidence</dt><dd className="mt-0.5 text-base font-bold">{report.forecastConfidence}/100</dd></div>}
          {primarySwell && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Primary swell</dt><dd className="mt-0.5 text-base font-bold">{primarySwell}</dd></div>}
          {secondarySwell && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Secondary swell</dt><dd className="mt-0.5 text-base font-bold">{secondarySwell}</dd></div>}
          {wind && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Wind</dt><dd className="mt-0.5 text-base font-bold">{wind}</dd></div>}
          {tide && <div><dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">Tide</dt><dd className="mt-0.5 text-base font-bold">{tide}</dd></div>}
        </dl>
      ) : (
        <p className="mt-4 font-mono text-sm leading-6 text-[#11100D]/75">
          Current forecast details are temporarily unavailable. Check back for the next Quiver surf call and hourly conditions.
        </p>
      )}

      {report?.whySentence && (
        <p className="mt-5 font-mono text-sm leading-6 text-[#11100D]">
          <strong className="font-bold">Why:</strong> {report.whySentence}
        </p>
      )}

      {(validAt || sourceUpdatedAt || computedAt) && <div className="mt-5 border-t-2 border-dashed border-[#0B3A75]/30 pt-3 font-mono text-[11px] leading-5 text-[#11100D]/70">
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
    </section>
  );
}
