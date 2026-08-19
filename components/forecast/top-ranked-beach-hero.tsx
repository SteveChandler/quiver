import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin, Waves } from "lucide-react";

import type { BeachConditionSummary } from "@/lib/utils/regional-forecast-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { formatWaveHeightDecimal } from "@/lib/utils/wave-formatters";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";
import { getScoreCall } from "./score-band-call";

type HeroSurfWindow = Pick<
  SurfWindowRecommendation,
  | "startIso"
  | "endIso"
  | "peakIso"
  | "timezone"
  | "localTimeLabel"
  | "score"
  | "verdict"
  | "confidence"
  | "positives"
>;

interface TopRankedBeachHeroProps {
  beach: BeachConditionSummary;
  regionName: string;
  now?: Date;
  imageUrl?: string | null;
  mapImageUrl?: string | null;
  bestSurfWindow?: HeroSurfWindow | null;
}

function formatPeakTime(peakIso: string, timezone: string): string {
  const peakDate = new Date(peakIso);
  if (!Number.isFinite(peakDate.getTime())) return "Not available";

  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(peakDate);
  } catch {
    return "Not available";
  }
}

function includesInstant(window: HeroSurfWindow, instant: Date): boolean {
  const start = Date.parse(window.startIso);
  const end = Date.parse(window.endIso);
  const current = instant.getTime();
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= current &&
    current <= end
  );
}

function scheduledAction(window: HeroSurfWindow): string {
  const start = new Date(window.startIso);
  if (!Number.isFinite(start.getTime())) return window.verdict;

  try {
    const date = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: window.timezone,
    }).format(start);
    return `${window.verdict} · ${date}`;
  } catch {
    return window.verdict;
  }
}

export function TopRankedBeachHero({
  beach,
  regionName,
  now = new Date(),
  imageUrl,
  mapImageUrl,
  bestSurfWindow,
}: TopRankedBeachHeroProps) {
  const selectedScore = bestSurfWindow?.score ?? beach.currentScore;
  const scoreCall = getScoreCall(selectedScore);
  const isLive = bestSurfWindow ? includesInstant(bestSurfWindow, now) : false;
  // Only reframe as "upcoming" when there is a real window to point at; with no
  // window the card falls back to the score ranking and stays "ranked first".
  const isUpcoming = Boolean(bestSurfWindow) && !isLive;
  const action = bestSurfWindow
    ? isLive
      ? scoreCall.action
      : scheduledAction(bestSurfWindow)
    : "Check back soon";
  const imageSource = imageUrl ?? mapImageUrl ?? null;
  const imageAlt = imageUrl
    ? `${beach.beachName} beach photo`
    : `Satellite map centered on ${beach.beachName}`;
  const beachHref = buildBeachUrl({
    slug: beach.beachSlug,
    city: beach.city,
    state: beach.state,
    country: beach.country,
  });

  return (
    <article
      className="mb-16 grid min-w-0 overflow-hidden border-2 border-[#11100D] bg-[#F0E5CC] shadow-[4px_5px_0_rgba(17,16,13,0.2)] md:grid-cols-[1.15fr_0.85fr]"
      data-testid="top-ranked-beach-hero"
    >
      <div className="relative min-h-[260px] bg-[#D9C49C] md:min-h-[360px]">
        {imageSource ? (
          <Image
            src={imageSource}
            alt={imageAlt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 55vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-[#11100D]">
            <MapPin className="h-10 w-10" aria-hidden="true" />
            <p className="font-mono text-xs font-bold uppercase tracking-[0.14em]">
              No approved image on file
            </p>
            <p className="max-w-xs text-sm leading-relaxed">
              This ranking is live; the beach page has the full map and forecast.
            </p>
          </div>
        )}

        <div className="absolute left-4 top-4 bg-[#F4EBD8] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.3)]">
          {isUpcoming ? "Next best call" : "Top beach now"}
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-7 p-5 sm:p-7">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#B56A2B]">
            {isUpcoming ? "Best upcoming window in" : "Ranked first in"}{" "}
            {regionName || "this region"}
          </p>
          <h2 className="mt-3 break-words font-display text-3xl font-black uppercase leading-[0.95] text-[#11100D] sm:text-4xl">
            {beach.beachName}
          </h2>
        </div>

        <div className="flex items-end gap-3 border-2 border-[#11100D] bg-[#11100D] px-4 py-3 text-[#F4EBD8]">
          <span className="text-4xl font-black tabular-nums leading-none">
            {selectedScore}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em]">
              {scoreCall.label}
            </p>
            <p className="mt-1 font-display text-xl font-black leading-none text-[#F78E42]">
              {action}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="border-t-2 border-[#11100D]/25 pt-3">
            <dt className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#11100D]/65">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {!bestSurfWindow
                ? "Surf window"
                : includesInstant(bestSurfWindow, now)
                  ? "Surfable now"
                  : "Next window"}
            </dt>
            {bestSurfWindow ? (
              <>
                <dd className="mt-1 font-semibold text-[#11100D]">
                  {bestSurfWindow.localTimeLabel}
                </dd>
                <dd className="mt-1 text-xs text-[#11100D]/65">
                  Peak {formatPeakTime(bestSurfWindow.peakIso, bestSurfWindow.timezone)} ·{" "}
                  {bestSurfWindow.confidence.summary}
                </dd>
                <dd className="mt-1 text-xs text-[#11100D]/65">
                  {bestSurfWindow.positives[0] ?? "Selector conditions align"}
                </dd>
              </>
            ) : (
              <dd className="mt-1 font-semibold text-[#11100D]">
                Nothing qualifying in the forecast horizon
              </dd>
            )}
          </div>
          <div className="border-t-2 border-[#11100D]/25 pt-3">
            <dt className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#11100D]/65">
              <Waves className="h-4 w-4" aria-hidden="true" />
              Wave height
            </dt>
            <dd className="mt-1 font-semibold text-[#11100D]">
              {formatWaveHeightDecimal(beach.currentWaveHeight)}
            </dd>
          </div>
        </dl>

        <Link
          href={beachHref}
          className="inline-flex w-fit items-center gap-2 border-b-2 border-[#11100D] pb-1 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#11100D] transition-colors hover:border-[#B56A2B] hover:text-[#B56A2B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#11100D]"
        >
          Open beach forecast <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
