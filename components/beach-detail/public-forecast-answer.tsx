"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeForecastDateParam, normalizeForecastWindowParam } from "@/lib/utils/forecast-window-param";
import type { Beach } from "@/types/database";
import { formatBeachDateTime, formatDateInTimezone, formatTimeRangeInTimezone } from "@/lib/utils/date-time";
import { WaterQualityBadge, type WaterQuality } from "@/components/beach-detail/water-quality-badge";
import { RipCurrentWarning } from "@/components/beach-detail/rip-current-warning";
import { isDataStale } from "@/lib/utils/forecast-client-utils";
import { useAuthenticatedForecastDecision } from "@/components/beach-detail/authenticated-forecast-decision";
import { ForecastDecisionLoginLink } from "@/components/beach-detail/forecast-decision-login-link";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getSurfCallVerdictCall, SCORE_LABEL_INK } from "@/components/forecast/score-band-call";
import type {
  PublicForecastContextFacts,
  PublicForecastReportFacts,
  PublicGeneralCall,
} from "@/lib/utils/public-forecast-facts";

const DECK_LABEL =
  "font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#8A5E00]";
const DECK_VALUE =
  "mt-0.5 font-[family-name:var(--font-zine-display)] text-3xl leading-none text-[#11100D] sm:text-4xl";
const STRIP_LABEL =
  "font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#11100D]";

interface PublicForecastAnswerProps {
  beach: Beach;
  waterQuality?: WaterQuality | null;
  report: PublicForecastReportFacts | null;
  context: PublicForecastContextFacts | null;
  /** The call computed without a user, shown until a personal call resolves. */
  generalCall?: PublicGeneralCall | null;
  isTomorrow: boolean;
  publicDecisionWindow?: {
    start: string | null;
    end: string | null;
  };
  nearbyBeaches?: Array<
    Pick<Beach, "id" | "name" | "slug" | "city" | "state" | "country">
  >;
  headingLevel: "h1" | "h2";
  returnTo: string;
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
    case "FES2022":
      return "FES2022 tide model";
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
  waterQuality,
  report: publicReport,
  context: publicContext,
  generalCall = null,
  isTomorrow: publicIsTomorrow,
  publicDecisionWindow,
  nearbyBeaches = [],
  headingLevel,
  returnTo,
}: PublicForecastAnswerProps) {
  const searchParams = useSearchParams();
  const selectedDate = normalizeForecastDateParam(searchParams?.get("date"));
  const selectedWindow = selectedDate ? null : normalizeForecastWindowParam(searchParams?.get("window"));
  const selectedEnd = normalizeForecastWindowParam(searchParams?.get("windowEnd"));

  const hasSelection = Boolean(selectedWindow || selectedDate);
  const authenticatedDecision = useAuthenticatedForecastDecision();
  const decisionReport = !selectedDate && authenticatedDecision.isAuthenticated && !authenticatedDecision.isLoading
    ? authenticatedDecision.report
    : null;
  const decisionContext = decisionReport ? authenticatedDecision.context : null;
  const hasResolvedAuthenticatedDecision = decisionReport !== null && !selectedDate;
  const report = hasResolvedAuthenticatedDecision ? decisionReport : publicReport;
  const context = hasResolvedAuthenticatedDecision ? decisionContext : publicContext;
  const isTomorrow = hasResolvedAuthenticatedDecision
    ? authenticatedDecision.isTomorrow
    : publicIsTomorrow;
  const timezone =
    beach.timezone ??
    context?.timezone ??
    "UTC";
  const forecastDate = formatForecastDate(context?.localDate, timezone);
  const waveHeight = context?.waveHeightRangeLabel ?? context?.waveHeight ?? report?.waveHeight;
  // Once the authenticated decision resolves, its selection owns the answer
  // deck. Before then, keep the crawlable public window as context only.
  const [windowStart, windowEnd] = hasResolvedAuthenticatedDecision
    ? [
        decisionContext?.displayWindowStart ?? decisionReport.bestWindowStart,
        decisionContext?.displayWindowEnd ?? decisionReport.bestWindowEnd,
      ]
    : [publicDecisionWindow?.start ?? null, publicDecisionWindow?.end ?? null];
  const hasDisplayedWindow = Boolean(windowStart && windowEnd);
  const decisionCall = decisionReport?.verdict
    ? getSurfCallVerdictCall(
        decisionReport.verdict,
        decisionReport.score,
        isTomorrow ? "upcoming" : "now",
      )
    : null;
  // Native's guest view: the general call, the same for every surfer, until a
  // personal call resolves. It is the latest call, so a selected day or window
  // never shows it.
  const generalDecisionCall =
    generalCall && !hasSelection && !hasResolvedAuthenticatedDecision
      ? getSurfCallVerdictCall(
          generalCall.verdict,
          generalCall.score,
          isTomorrow ? "upcoming" : "now",
        )
      : null;
  const bestWindow = formatTimeRangeInTimezone(
    windowStart,
    windowEnd,
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
  // Native's tide read: phase first, then the height, e.g. "Rising · 3.2 ft".
  const tideParts = [
    report?.tidePhase
      ? report.tidePhase.charAt(0).toUpperCase() + report.tidePhase.slice(1)
      : null,
    report?.tideHeight?.replace(/(\d)(ft|m)\b/, "$1 $2"),
    report?.nextTideType ? `next ${report.nextTideType.toLowerCase()}` : null,
  ].filter((part): part is string => Boolean(part?.trim()));
  const tide = tideParts.length > 0 ? tideParts.join(" · ") : null;
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
  const hasForecastDetails = Boolean(
    decisionReport?.verdict ||
    generalDecisionCall ||
    (context?.selectedRowTime && waveHeight) ||
      (hasDisplayedWindow && (waveHeight || bestWindow || wind || tide)),
  );
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
      className="border-t-2 border-dashed border-[#11100D]/30 pt-5"
    >
      <HeadingTag id="public-forecast-answer-heading" className="font-mono text-sm font-bold uppercase text-[#8A5E00]">
        {beach.name} Surf Forecast{hasSelection ? "" : titleDate}
      </HeadingTag>
      {hasSelection ? (
        <p className="mt-3 text-base font-semibold" role="status">
          {selectedWindow ? <>Selected comparison window: {formatBeachDateTime(selectedWindow, timezone, "EEE, MMM d")}{" · "}
            {selectedEnd && Date.parse(selectedEnd) > Date.parse(selectedWindow)
              ? formatTimeRangeInTimezone(selectedWindow, selectedEnd, timezone)
              : formatBeachDateTime(selectedWindow, timezone, "h:mm a")}</> : <>Selected day: {selectedDate}</>}
          {" · "}{timezone}
        </p>
      ) : isTomorrow ? <p className="mt-2 text-sm font-bold">Tomorrow</p> : null}
      <RipCurrentWarning
        beachId={beach.id}
        localDate={selectedDate ?? (selectedWindow ? formatDateInTimezone(new Date(selectedWindow), timezone) : context?.localDate ?? formatDateInTimezone(new Date(), timezone))}
        timezone={timezone}
      />
      {(waterQuality?.status === "advisory" || waterQuality?.status === "closure") && (
        <div className="mt-3"><p className="text-sm font-bold">Current water notice · check again before your session</p><WaterQualityBadge waterQuality={waterQuality} beachState={beach.state} /></div>
      )}
      {hasSelection && !hasResolvedAuthenticatedDecision && (
        <p className="mt-3 text-base">
          {authenticatedDecision.isAuthenticated
            ? authenticatedDecision.isLoading ? "Loading the selected call…" : "Selected call unavailable. Check the dated conditions below."
            : <><ForecastDecisionLoginLink returnTo={`${returnTo}?${searchParams?.toString() ?? ""}`} /> for the surf verdict. Dated conditions are below.</>}
        </p>
      )}
      {isStale && <p role="status" className="mt-3 border-l-4 border-[#B47A0F] bg-[#F7E7BE] p-3 text-base">Source data is stale; conditions may have changed.</p>}
      <Link href={`${returnTo}?${new URLSearchParams({ ...Object.fromEntries(searchParams?.entries() ?? []), tab: "forecast" })}#operational-forecast`} className="rounded-full mt-4 inline-flex min-h-11 items-center border-2 border-[#11100D] bg-[#F78E42] px-4 text-base font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Explore forecast</Link>
      <details open={!hasSelection || hasResolvedAuthenticatedDecision} className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2">
          {hasResolvedAuthenticatedDecision && selectedWindow ? "Selected call" : "Latest forecast"}{titleDate}
        </summary>
      {hasForecastDetails ? (
        <div className="mt-4">
          {/* Deck: the answer itself, sized to win the squint test. */}
          <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
            {waveHeight && (
              <div>
                <dt className={DECK_LABEL}>Surf</dt>
                <dd className={DECK_VALUE}>{waveHeight}</dd>
              </div>
            )}
            {decisionCall && (
              <div>
                <dt className={DECK_LABEL}>Call</dt>
                <dd className={DECK_VALUE} style={{ color: SCORE_LABEL_INK[decisionCall.label] }}>
                  {decisionCall.label}
                </dd>
                <dd className="mt-1 text-base font-bold text-[#11100D]">{decisionCall.action}</dd>
              </div>
            )}
            {generalDecisionCall && (
              <div data-testid="public-general-call">
                <dt className={DECK_LABEL}>General forecast</dt>
                <dd className={DECK_VALUE} style={{ color: SCORE_LABEL_INK[generalDecisionCall.label] }}>
                  {generalDecisionCall.label}
                </dd>
                <dd className="mt-1 text-base font-bold text-[#11100D]">{generalDecisionCall.action}</dd>
                <dd className="mt-1 max-w-[17rem] text-sm leading-snug text-[#4A463C]">
                  Same for every surfer. Not adjusted for your level or boards.
                </dd>
                {!authenticatedDecision.isAuthenticated && (
                  <dd className="mt-2">
                    <ForecastDecisionLoginLink returnTo={returnTo} label="Get your call" />
                  </dd>
                )}
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
            {!decisionReport?.verdict && !generalDecisionCall && !bestWindow && !hasDisplayedWindow && (
              <div>
                <dt className={DECK_LABEL}>Verdict &amp; best window</dt>
                <dd className="mt-1.5">
                  {authenticatedDecision.isAuthenticated ? (
                    <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D]/60">
                      {authenticatedDecision.isLoading
                        ? "Loading your call…"
                        : "Call unavailable"}
                    </span>
                  ) : (
                    <ForecastDecisionLoginLink returnTo={returnTo} />
                  )}
                </dd>
              </div>
            )}
          </dl>

          {/* Matches the bordered fact boxes used across the zine tabs:
              rounded-[8px] + 2px ink border + hard offset shadow. The
              .condition-strip class draws a 1px inset instead, which read as a
              flat unoutlined panel next to them. */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#11100D] shadow-[3px_3px_0_#11100D] lg:grid-cols-4">
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
                <div key={cell.label} className="min-w-0 bg-[#EFE5CF] px-4 py-3">
                  <dt className={STRIP_LABEL}>{cell.label}</dt>
                  <dd className="mt-1 font-[family-name:var(--font-zine-display)] text-xl leading-tight text-[#11100D] sm:text-2xl">
                    {cell.value}
                  </dd>
                </div>
              ))}
          </dl>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-bold focus-visible:outline focus-visible:outline-2">Sources &amp; forecast details</summary>
          {(secondarySwell || decisionReport?.score != null) && (
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-[#11100D]/75">
              {secondarySwell && (
                <div className="flex gap-1.5">
                  <dt className="font-bold uppercase tracking-[0.14em]">Secondary swell</dt>
                  <dd>{secondarySwell}</dd>
                </div>
              )}
              {decisionReport?.bestWindowStart && decisionReport.bestWindowEnd && decisionReport.score != null && (
                <div className="flex gap-1.5">
                  <dt className="font-bold uppercase tracking-[0.14em]">Score</dt>
                  <dd>{decisionReport.score}/100</dd>
                </div>
              )}
            </dl>
          )}
          {provenance.length > 0 && <p className="mt-3 text-sm leading-6">{provenance.join(" · ")}</p>}
          <Link href="/forecast-accuracy" className="mt-2 inline-block underline">Forecast accuracy &amp; methodology</Link>
          </details>
        </div>
      ) : (
        // Always explain an empty forecast. The route passes publicDecisionWindow
        // as an object literal on every beach page, so gating this on its
        // presence silently rendered nothing at all when no data was available.
        <p className="mt-4 font-mono text-sm leading-6 text-[#11100D]/75">
          Current forecast details are temporarily unavailable. Check back for the next Quiver surf call and hourly conditions.
        </p>
      )}

      {decisionReport?.whySentence && (
        <p className="mt-5 max-w-2xl font-mono text-sm leading-6 text-[#11100D]">
          <strong className="font-bold">Why:</strong> {decisionReport.whySentence}
        </p>
      )}

      </details>

      {nearbyBeaches.length > 0 && (
        <nav aria-label="Nearby spots" className="mt-5">
          <p className={DECK_LABEL}>Nearby spots</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {nearbyBeaches.slice(0, 3).map((backup) => (
              <Link
                key={backup.id}
                href={buildBeachUrl(backup)}
                className="border-2 border-[#11100D] bg-[#EFE5CF] px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#11100D] shadow-[2px_2px_0_#11100D] hover:bg-[#F7E7BE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE5CF]"
              >
                {backup.name}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </section>
  );
}
