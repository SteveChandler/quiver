import { Suspense } from 'react';
import type { SurfCallResult } from '@/lib/utils/surf-call-logic';
import type { Beach } from '@/types/database';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone-constants';
import { getSpotSurfReport } from '@/actions/spot/spot-surf-report-actions';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';

interface SpotSurfReportProps {
  report: SurfCallResult;
  spotName: string;
  timezone?: string;
}

const VERDICT_STYLES = {
  YES: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  MAYBE: 'bg-amber-100 text-amber-800 border-amber-200',
  NO: 'bg-slate-100 text-slate-600 border-slate-200',
} as const;

const UNKNOWN_VALUE = 'Unknown';

function formatTime(isoString: string, timezone?: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || DEFAULT_TIMEZONE,
    }).format(date);
  } catch {
    return '';
  }
}

function isValidVerdict(verdict: string): verdict is keyof typeof VERDICT_STYLES {
  return verdict in VERDICT_STYLES;
}

export function SpotSurfReport({ report, spotName, timezone }: SpotSurfReportProps) {
  const hasWindow = report.bestWindowStart && report.bestWindowEnd;
  const verdictStyle = isValidVerdict(report.verdict)
    ? VERDICT_STYLES[report.verdict]
    : VERDICT_STYLES.NO;
  const updatedTime = formatTime(report.updatedAt, timezone);

  return (
    <section
      aria-label={`Today's surf call for ${spotName}`}
      className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:px-8"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-bold ${verdictStyle}`}
            >
              {report.verdict}
            </span>
            <h2 className="text-lg font-semibold text-slate-900">
              Today&apos;s Surf Call
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {report.lowForecastConfidence && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-200">
                Low forecast confidence
              </span>
            )}
            {updatedTime && (
              <span>Updated {updatedTime}</span>
            )}
          </div>
        </div>

        {/* Conditions grid */}
        {hasWindow && (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Best window
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {formatTime(report.bestWindowStart!, timezone)}–{formatTime(report.bestWindowEnd!, timezone)}
              </dd>
            </div>
            {report.waveHeight && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Size
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {report.waveHeight}
                </dd>
              </div>
            )}
            {report.windDescription && report.windDescription !== UNKNOWN_VALUE && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Wind
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {report.windDescription}
                </dd>
              </div>
            )}
            {report.tideDescription && report.tideDescription !== UNKNOWN_VALUE && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Tide
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {report.tideDescription}
                </dd>
              </div>
            )}
          </dl>
        )}

        {/* Why sentence */}
        {report.whySentence && (
          <p className="mt-3 text-sm italic text-slate-600">
            &ldquo;{report.whySentence}&rdquo;
          </p>
        )}
      </div>
    </section>
  );
}

function SpotSurfReportSkeleton() {
  return (
    <section
      aria-label="Loading surf call"
      className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:px-8"
    >
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-7 w-16 rounded-md bg-slate-200" />
          <div className="h-6 w-36 rounded bg-slate-200" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-16 rounded bg-slate-100" />
              <div className="mt-2 h-5 w-20 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface SpotSurfReportLoaderProps {
  beach: Beach;
}

async function SpotSurfReportLoader({ beach }: SpotSurfReportLoaderProps) {
  const surfReport = await getSpotSurfReport(beach);
  if (!surfReport) return null;

  const timezone = beach.lat != null && beach.lon != null
    ? getTimezoneFromCoords(beach.lat, beach.lon)
    : undefined;

  return (
    <SpotSurfReport
      report={surfReport}
      spotName={beach.name}
      timezone={timezone || undefined}
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
