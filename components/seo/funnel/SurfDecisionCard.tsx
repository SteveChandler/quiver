import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Compass,
  Flag,
  ShipWheel,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";

import { getBeachesBySlug } from "@/actions/beach/beach-query-actions";
import {
  getSurfCallVerdictCall,
  SCORE_LABEL_INK,
  SCORE_LABEL_PAPER_WASH,
} from "@/components/forecast/score-band-call";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import type { SeoDecisionConfig } from "@/lib/seo/funnel-pages";
import { formatTimeRangeInTimezone } from "@/lib/utils/date-time";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import type { Beach } from "@/types/database";

interface SurfDecisionCardProps {
  decision: SeoDecisionConfig;
}

const FALLBACK_MESSAGE =
  "Live Quiver conditions are temporarily unavailable. Check the app for the freshest read before you drive.";

function pickBeachBySlug(beaches: Beach[] | null | undefined, slug: string): Beach | null {
  if (!beaches || beaches.length === 0) return null;
  return beaches.find((beach) => beach.slug === slug) ?? beaches[0] ?? null;
}

function riskLabel(value: string | null | undefined, fallback: string): string {
  if (!value || value === "Unknown") return fallback;
  return value;
}

export async function SurfDecisionCard({ decision }: SurfDecisionCardProps) {
  const beachResult = await getBeachesBySlug(decision.primarySpotSlug);
  const beach = pickBeachBySlug(
    beachResult.success ? beachResult.data ?? [] : [],
    decision.primarySpotSlug
  );
  const surfReportResult = beach ? await getSpotSurfReportPublic(beach) : null;
  const report = surfReportResult?.report ?? null;
  const timezone =
    beach?.lat != null && beach?.lon != null
      ? getTimezoneFromCoords(beach.lat, beach.lon)
      : undefined;
  const hasLiveData = Boolean(
    report?.waveHeight || report?.bestWindowStart || report?.windDescription
  );
  const backupBeaches = await Promise.all(
    decision.nearbySpotSlugs.map(async (slug) => {
      const result = await getBeachesBySlug(slug);
      return pickBeachBySlug(result.success ? result.data ?? [] : [], slug);
    })
  );
  // The internal YES / MAYBE / NO verdict is never copy: show the rating and
  // its call, as native does.
  const call =
    hasLiveData && report?.verdict
      ? getSurfCallVerdictCall(report.verdict, report.score)
      : null;
  const bestWindow = hasLiveData
    ? formatTimeRangeInTimezone(
        report?.bestWindowStart ?? null,
        report?.bestWindowEnd ?? null,
        timezone,
        "-",
      ) ?? "No clean window yet"
    : "Refresh in Quiver";
  const windRisk = hasLiveData
    ? riskLabel(report?.windDescription, decision.windRisk)
    : decision.windRisk;
  const tideRisk = hasLiveData
    ? riskLabel(report?.tideDescription, decision.tideRisk)
    : decision.tideRisk;

  return (
    <section aria-labelledby="surf-decision-heading" className="py-4">
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-md md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#8A5E00]">
              Today&apos;s call
            </p>
            <h2
              id="surf-decision-heading"
              className="mt-1 font-heading text-2xl font-bold text-gray-900"
            >
              {decision.fallbackSpotName} surf call
            </h2>
            {!hasLiveData ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-700">
                {FALLBACK_MESSAGE}
              </p>
            ) : report?.whySentence ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-700">
                {report.whySentence}
              </p>
            ) : null}
          </div>
          {call ? (
            <div
              className="w-fit min-w-[11rem] border-[2.5px] border-[#11100D] px-4 pb-2.5 pt-2 shadow-[5px_5px_0_#11100D]"
              style={{
                background: SCORE_LABEL_PAPER_WASH[call.label],
                borderRadius: "12px 4px 14px 6px",
              }}
              data-testid="surf-decision-call"
            >
              <p
                className="font-heading text-3xl font-bold uppercase leading-none"
                style={{ color: SCORE_LABEL_INK[call.label] }}
              >
                {call.label}
              </p>
              <p className="mt-1 text-base font-bold text-[#11100D]">{call.action}</p>
            </div>
          ) : (
            <div className="w-fit border-[2.5px] border-[#11100D] bg-[#F4EBD8] px-4 py-2 font-heading text-xl font-bold text-[#11100D]" style={{ borderRadius: "12px 4px 14px 6px" }}>
              Check the app
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <DecisionMetric icon={Clock} label="Best window" value={bestWindow} />
          <DecisionMetric
            icon={Waves}
            label="Surf"
            value={report?.waveHeight ?? "Check current reading"}
          />
          <DecisionMetric
            icon={ShipWheel}
            label="Board call"
            value={decision.boardCall}
          />
          <DecisionMetric
            icon={Thermometer}
            label="Wetsuit call"
            value={decision.wetsuitCall}
          />
          <DecisionMetric icon={Compass} label="Tide risk" value={tideRisk} />
          <DecisionMetric icon={Wind} label="Wind risk" value={windRisk} />
        </div>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <p className="text-sm leading-6 text-amber-800">
              {decision.crowdParkingNote}
            </p>
          </div>
        </div>

        {backupBeaches.some(Boolean) ? (
          <div className="mt-5">
            <h3 className="flex items-center gap-2 font-heading text-base font-bold text-gray-900">
              <Flag className="h-4 w-4 text-ocean-blue" aria-hidden />
              Nearby backups
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {backupBeaches.filter(Boolean).map((backup) => (
                <Link
                  key={backup!.id}
                  href={buildBeachUrl(backup!)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-ocean-blue/40 hover:text-ocean-blue"
                >
                  {backup!.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface DecisionMetricProps {
  icon: typeof Clock;
  label: string;
  value: string;
}

function DecisionMetric({ icon: Icon, label, value }: DecisionMetricProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500">
        <Icon className="h-4 w-4 text-ocean-blue" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-gray-900">
        {value}
      </p>
    </div>
  );
}
