import type { Beach } from "@/types/database";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import { formatBeachDateTime, formatTimeInTimezone } from "@/lib/utils/date-time";
import { isDataStale } from "@/lib/utils/forecast-client-utils";

// Same contrast-checked verdict palette the in-tab surf call uses on tan paper.
const VERDICT_COLOR: Record<string, string> = {
  YES: "#006B5F",
  MAYBE: "#B47A0F",
  NO: "#5C5A57",
};

const DECK_LABEL =
  "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#0B3A75]";
const DECK_VALUE =
  "mt-0.5 font-[var(--font-zine-display)] text-3xl leading-none text-[#11100D] sm:text-4xl";
const STRIP_LABEL =
  "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#11100D]";

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
  const provenance = [
    validAt ? `Valid ${validAt} ${timezone}` : null,
    sourceUpdatedAt ? `Source updated ${sourceUpdatedAt}` : null,
    computedAt ? `Computed ${computedAt}` : null,
    context?.contributingSources?.length
      ? context.contributingSources.map(sourceLabel).join(", ")
      : null,
  ].filter(Boolean) as string[];

  return (
    <section
      aria-labelledby="public-forecast-answer-heading"
      data-testid="public-forecast-answer"
      className="border-t-2 border-dashed border-[#0B3A75]/30 pt-5"
    >
      {/* Sits directly under the hero's beach name, so this is a label line,
          not a second display headline. The full "<Beach> Surf Forecast" string
          stays intact for the H1 contract; only its weight comes down. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <HeadingTag
          id="public-forecast-answer-heading"
          className="max-w-xl font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#0B3A75]"
        >
          {beach.name} Surf Forecast{titleDate}
        </HeadingTag>
        {/* The date alone does not read as "not today" at a glance. */}
        {isTomorrow && (
          <span className="border border-[#11100D] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#11100D]">
            Tomorrow
          </span>
        )}
      </div>

      {hasForecastDetails ? (
        <dl className="mt-4">
          {/* Deck: the answer itself, sized to win the squint test. */}
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
            {waveHeight && (
              <div>
                <dt className={DECK_LABEL}>Surf</dt>
                <dd className={DECK_VALUE}>{waveHeight}</dd>
              </div>
            )}
            {report?.verdict && (
              <div>
                <dt className={DECK_LABEL}>Verdict</dt>
                <dd className={DECK_VALUE} style={{ color: VERDICT_COLOR[report.verdict] }}>
                  {report.verdict}
                </dd>
              </div>
            )}
            {bestWindow && (
              <div>
                <dt className={DECK_LABEL}>Best window</dt>
                <dd className="mt-0.5 font-mono text-lg font-bold leading-none text-[#11100D] sm:text-xl">
                  {bestWindow}
                </dd>
              </div>
            )}
          </div>

          {/* Supporting reads, in the page's own condition-strip. */}
          <div className="condition-strip mt-6">
            {[
              { label: "Primary swell", value: primarySwell },
              { label: "Wind", value: wind },
              { label: "Tide", value: tide },
              {
                label: "Confidence",
                value:
                  report?.forecastConfidence != null
                    ? `${report.forecastConfidence}/100`
                    : null,
              },
            ]
              .filter((cell) => cell.value)
              .map((cell) => (
                <div key={cell.label} className="min-w-0 px-2">
                  <dt className={STRIP_LABEL}>{cell.label}</dt>
                  <dd className="mt-1 font-[var(--font-zine-display)] text-xl leading-tight text-[#11100D] sm:text-2xl">
                    {cell.value}
                  </dd>
                </div>
              ))}
          </div>

          {(secondarySwell || report?.score != null) && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-[#11100D]/75">
              {secondarySwell && (
                <div className="flex gap-1.5">
                  <dt className="font-bold uppercase tracking-[0.14em]">Secondary swell</dt>
                  <dd>{secondarySwell}</dd>
                </div>
              )}
              {report?.score != null && (
                <div className="flex gap-1.5">
                  <dt className="font-bold uppercase tracking-[0.14em]">Score</dt>
                  <dd>{report.score}/100</dd>
                </div>
              )}
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-4 font-mono text-sm leading-6 text-[#11100D]/75">
          Current forecast details are temporarily unavailable. Check back for the next Quiver surf call and hourly conditions.
        </p>
      )}

      {report?.whySentence && (
        <p className="mt-5 max-w-2xl font-mono text-sm leading-6 text-[#11100D]">
          <strong className="font-bold">Why:</strong> {report.whySentence}
        </p>
      )}

      {/* One provenance line, not four. Every fact a crawler needs is still
          here; it just no longer reads as a paragraph of boilerplate. */}
      {provenance.length > 0 && (
        <p className="mt-4 font-mono text-[11px] leading-5 text-[#11100D]/55">
          {provenance.join(" · ")}
          {isStale ? " · Source data is stale; conditions may have changed." : ""}
        </p>
      )}
    </section>
  );
}
