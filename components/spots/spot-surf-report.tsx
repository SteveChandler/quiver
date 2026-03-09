import React, { Suspense } from 'react';
import type { SurfCallResult } from '@/lib/utils/surf-call-logic';
import type { Beach } from '@/types/database';
import { getSpotSurfReport } from '@/actions/spot/spot-surf-report-actions';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { formatTimeInTimezone, formatTimeCasual } from '@/lib/utils/time-formatting';
import { PublicContentGate } from '@/components/ui/public-content-gate';

interface SpotSurfReportProps {
  report: SurfCallResult;
  spotName: string;
  timezone?: string;
  isTomorrow?: boolean;
}

const VERDICT_STYLES = {
  YES: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  MAYBE: 'bg-amber-50 text-amber-700 border-amber-200/80',
  NO: 'bg-slate-50 text-slate-600 border-slate-200/80',
} as const;

function formatTime(isoString: string, timezone?: string): string {
  return formatTimeInTimezone(isoString, timezone);
}

function isValidVerdict(verdict: string): verdict is keyof typeof VERDICT_STYLES {
  return verdict in VERDICT_STYLES;
}

export function SpotSurfReport({ report, spotName, timezone, isTomorrow = false }: SpotSurfReportProps) {
  const hasWindow = report.bestWindowStart && report.bestWindowEnd;
  const showBestWindow = hasWindow && report.verdict !== 'NO';
  const verdictStyle = isValidVerdict(report.verdict)
    ? VERDICT_STYLES[report.verdict]
    : VERDICT_STYLES.NO;
  const updatedTime = formatTime(report.updatedAt, timezone);
  const heading = isTomorrow ? "Tomorrow\u2019s Surf Call" : "Today\u2019s Surf Call";

  // Format wind display: "NW 12–16 mph (cross-shore)"
  const windDisplay = report.windSpeed && report.windSpeed !== 'Unknown'
    ? [report.windCompass, report.windSpeed, report.windType ? `(${report.windType})` : null]
        .filter(Boolean).join(' ')
    : report.windDescription !== 'Unknown' ? report.windDescription : null;

  // Format tide display: "Rising → High @ 1:10 PM" or "Rising 2.3ft"
  let tideDisplay: string | null = null;
  if (report.tidePhase) {
    const phase = report.tidePhase.charAt(0).toUpperCase() + report.tidePhase.slice(1);
    if (report.nextTideType && report.nextTideAt) {
      const tideTime = formatTime(report.nextTideAt, timezone);
      if (tideTime) {
        tideDisplay = `${phase} \u2192 ${report.nextTideType.charAt(0).toUpperCase() + report.nextTideType.slice(1)} @ ${tideTime}`;
      } else {
        tideDisplay = phase;
      }
    } else if (report.tideHeight) {
      tideDisplay = `${phase} ${report.tideHeight}`;
    } else {
      tideDisplay = phase;
    }
  }

  // Show "Best at X" for windows > 3 hours (180 minutes)
  const peakTimeCasual = report.peakTime ? formatTimeCasual(report.peakTime, timezone) : null;
  const showBestAtTag = report.windowMinutes != null && report.windowMinutes > 180 && peakTimeCasual;

  return (
    <section
      aria-label={`${isTomorrow ? "Tomorrow's" : "Today's"} surf call for ${spotName}`}
      className="mb-4 sm:mb-6"
    >
      <div className="rounded-3xl border border-blue-100/60 bg-white/95 p-4 sm:p-5 shadow-lg backdrop-blur">
        <PublicContentGate
          ctaTitle="See Today's Best Window"
          ctaDescription="Sign up to see surf conditions — best time, wave height, wind, and tide"
          blurLevel="sm"
          source="surf-call-conditions"
        >
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-sm font-bold ${verdictStyle}`}
              >
                {report.verdict}
              </span>
              {report.shortWindow && report.verdict !== 'NO' && (
                <span className="inline-flex items-center rounded-lg border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Short window
                </span>
              )}
              {showBestAtTag && report.verdict !== 'NO' && (
                <span className="inline-flex items-center rounded-lg border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Best at {peakTimeCasual}
                </span>
              )}
              <h2 className="text-base sm:text-lg font-semibold text-dark-grey">
                {heading}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {report.lowForecastConfidence && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-200/80">
                    Low confidence
                  </span>
                )}
                {updatedTime && (
                  <span>Updated {updatedTime}</span>
                )}
              </div>
            </div>
          </div>

          {/* Conditions row + why sentence */}
          {(showBestWindow || report.waveHeight || windDisplay || tideDisplay) && (
            <div className="mt-3 sm:mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {(() => {
                const items: React.ReactNode[] = [];
                if (showBestWindow) {
                  items.push(
                    <div key="window">
                      <span className="text-xs uppercase tracking-[0.2em] text-ocean-blue">Best window</span>
                      <span className="ml-2 font-roboto font-semibold text-dark-grey">
                        {formatTime(report.bestWindowStart!, timezone)}–{formatTime(report.bestWindowEnd!, timezone)}
                      </span>
                    </div>
                  );
                }
                if (report.waveHeight) {
                  items.push(<span key="wave" className="font-roboto font-semibold text-dark-grey">{report.waveHeight}</span>);
                }
                if (windDisplay) {
                  items.push(<span key="wind" className="font-roboto text-sm text-dark-grey">{windDisplay}</span>);
                }
                if (tideDisplay) {
                  items.push(<span key="tide" className="font-roboto text-sm text-dark-grey">{tideDisplay}</span>);
                }
                return items.flatMap((item, i) =>
                  i === 0 ? [item] : [<span key={`sep-${i}`} className="text-slate-300">&middot;</span>, item]
                );
              })()}
            </div>
          )}

          {/* Why sentence */}
          {report.whySentence && (
            <p className="mt-2 sm:mt-3 text-sm text-muted-foreground">
              {report.whySentence}
            </p>
          )}
        </PublicContentGate>
      </div>
    </section>
  );
}

function SpotSurfReportSkeleton() {
  return (
    <section
      aria-label="Loading surf call"
      className="mb-4 sm:mb-6"
    >
      <div className="animate-pulse rounded-3xl border border-blue-100/60 bg-white/95 p-4 sm:p-5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-7 w-16 rounded-xl bg-slate-200" />
          <div className="h-6 w-36 rounded bg-slate-200" />
        </div>
        <div className="mt-3 sm:mt-4 flex gap-4">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-4 w-20 rounded bg-slate-100" />
          <div className="h-4 w-16 rounded bg-slate-100" />
        </div>
      </div>
    </section>
  );
}

interface SpotSurfReportLoaderProps {
  beach: Beach;
}

async function SpotSurfReportLoader({ beach }: SpotSurfReportLoaderProps) {
  const result = await getSpotSurfReport(beach);
  if (!result) return null;

  const timezone = beach.lat != null && beach.lon != null
    ? getTimezoneFromCoords(beach.lat, beach.lon)
    : undefined;

  return (
    <SpotSurfReport
      report={result.report}
      spotName={beach.name}
      timezone={timezone || undefined}
      isTomorrow={result.isTomorrow}
    />
  );
}

interface SpotSurfReportStreamProps {
  beach: Beach;
}

export function SpotSurfReportStream({ beach }: SpotSurfReportStreamProps) {
  return (
    <Suspense fallback={<SpotSurfReportSkeleton />}>
      <SpotSurfReportLoader beach={beach} />
    </Suspense>
  );
}
