/**
 * CityConditionsHero — "Surf Report Today" section for city hub pages.
 *
 * Server component that renders today's conditions summary above the beach
 * directory, targeting "[city] surf report today" search queries.
 */

import Link from "next/link";
import { AlertCaptureCta } from "@/components/seo/alert-capture-cta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import type { CitySurfReportSummary, CityBeachCondition } from "@/actions/city/city-conditions-actions";

// ---------------------------------------------------------------------------
// Verdict badge config
// ---------------------------------------------------------------------------

const VERDICT_CONFIG: Record<
  CitySurfReportSummary["overallVerdict"],
  { label: string; bgClass: string; textClass: string; dotClass: string }
> = {
  firing: {
    label: "Firing",
    bgClass: "bg-green-100",
    textClass: "text-green-800",
    dotClass: "bg-green-500",
  },
  good: {
    label: "Good Conditions",
    bgClass: "bg-emerald-100",
    textClass: "text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  fair: {
    label: "Fair Conditions",
    bgClass: "bg-amber-100",
    textClass: "text-amber-800",
    dotClass: "bg-amber-500",
  },
  poor: {
    label: "Poor Conditions",
    bgClass: "bg-gray-100",
    textClass: "text-gray-700",
    dotClass: "bg-gray-400",
  },
};

function VerdictDot({ verdict }: { verdict: CitySurfReportSummary["overallVerdict"] }) {
  const config = VERDICT_CONFIG[verdict];
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotClass}`}
      aria-hidden="true"
    />
  );
}

const VERDICT_LABEL_COLOR: Record<CitySurfReportSummary["overallVerdict"], string> = {
  firing: "text-green-600",
  good: "text-emerald-600",
  fair: "text-amber-600",
  poor: "text-gray-500",
};

function VerdictLabel({ verdict }: { verdict: CitySurfReportSummary["overallVerdict"] }) {
  const config = VERDICT_CONFIG[verdict];
  return (
    <span className={`text-xs font-semibold ${VERDICT_LABEL_COLOR[verdict]}`}>
      {config.label.replace(" Conditions", "")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return "over a day ago";
}

function beachUrl(beach: CityBeachCondition): string {
  return buildBeachUrl({
    slug: beach.beachSlug,
    city: beach.citySlug,
    state: beach.stateSlug,
  });
}

function rowVerdict(score: number): CitySurfReportSummary["overallVerdict"] {
  if (score >= 70) return "firing";
  if (score >= 45) return "good";
  if (score >= 20) return "fair";
  return "poor";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CityConditionsHeroProps {
  cityName: string;
  stateSlug: string;
  citySlug: string;
  report: CitySurfReportSummary;
}

export function CityConditionsHero({
  cityName,
  stateSlug,
  citySlug,
  report,
}: CityConditionsHeroProps) {
  if (report.beaches.length === 0) {
    return null;
  }

  const verdictConfig = VERDICT_CONFIG[report.overallVerdict];
  const best = report.bestBeach;

  return (
    <section
      aria-labelledby="city-surf-report-heading"
      className="mb-10 rounded-xl border border-gray-200 border-t-[3px] border-t-ocean-blue bg-white p-6 shadow-sm"
    >
      {/* Header row */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2
          id="city-surf-report-heading"
          className="text-xl font-bold text-gray-900 font-heading"
        >
          Surf Report Today
        </h2>
        <span className="text-xs text-gray-500">
          Updated {timeAgo(report.updatedAt)}
        </span>
      </div>

      {/* Verdict badge */}
      <div className="mb-6">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-semibold ${verdictConfig.bgClass} ${verdictConfig.textClass}`}
        >
          <VerdictDot verdict={report.overallVerdict} />
          {verdictConfig.label}
        </span>
      </div>

      {/* Best beach card */}
      {best && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500 mb-2">
            Best Right Now
          </p>
          <div className="rounded-lg border border-ocean-blue/20 bg-ocean-blue/5 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">
                {best.beachName}
              </span>
              {best.waveHeight && (
                <>
                  <span className="text-gray-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-gray-700">{best.waveHeight}</span>
                </>
              )}
              <span className="text-gray-400" aria-hidden="true">
                ·
              </span>
              <VerdictDot verdict={report.overallVerdict} />
            </div>
            {best.whySentence && (
              <p className="text-sm text-gray-600 mb-2">{best.whySentence}</p>
            )}
            <Link
              href={beachUrl(best)}
              className="inline-flex items-center text-sm font-medium text-[#F78E42] hover:underline"
            >
              View Forecast →
            </Link>
          </div>
        </div>
      )}

      {/* All beaches table */}
      {report.beaches.length > 1 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500 mb-2">All Beaches</p>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm" aria-label={`${cityName} surf conditions`}>
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4 pl-2 font-medium">Beach</th>
                  <th className="pb-2 pr-4 font-medium">Height</th>
                  <th className="pb-2 pr-4 font-medium">Wind</th>
                  <th className="pb-2 font-medium">
                    <span className="sr-only">Verdict</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.beaches.map((beach) => {
                  const verdict = rowVerdict(beach.score);
                  return (
                    <tr
                      key={beach.beachId}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="py-2 pr-4 pl-2">
                        <Link
                          href={beachUrl(beach)}
                          className="text-gray-900 hover:text-ocean-blue font-medium"
                        >
                          {beach.beachName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">
                        {beach.waveHeight ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">
                        {beach.windDescription ?? "—"}
                      </td>
                      <td className="py-2">
                        <VerdictLabel verdict={verdict} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alert capture CTA */}
      {best && (
        <AlertCaptureCta
          pageContext="city-surf-report"
          beachId={best.beachId}
          beachName={best.beachName}
          source={`city-hub-${citySlug}-${stateSlug}`}
        />
      )}
    </section>
  );
}
