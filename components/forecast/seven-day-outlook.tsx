/**
 * Seven-Day Outlook (server component)
 *
 * Replaces the old wall-of-17-region-cards with a single-region, day-by-day
 * strip. One row per forecast day in the active region. Peak day is visually
 * anchored with a Charming Orange left-edge accent. Trend dot at the right
 * edge shows direction vs the prior day.
 *
 * No sparklines, no nested cards, no ScrollReveal — paints fully on first byte.
 *
 * @module components/forecast/seven-day-outlook
 */

import type { RegionalForecastSummary } from "@/lib/utils/regional-forecast-utils";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { SwellArc, type SwellArcPoint } from "./swell-arc";

interface SevenDayOutlookProps {
  summary: RegionalForecastSummary | undefined;
  regionName: string;
  variant?: "default" | "zine";
}

function daySubtitle(
  windConditions: "offshore" | "light" | "onshore",
  score: number,
): string {
  if (score >= 80)
    return windConditions === "offshore" ? "Glassy, all timing." : "Firing.";
  if (score >= 60)
    return windConditions === "offshore"
      ? "Offshore AM, get on it."
      : "Solid — pick your window.";
  if (score >= 40)
    return windConditions === "onshore"
      ? "Wind-chopped but rideable."
      : "Small but fun.";
  return windConditions === "onshore"
    ? "Call it a no."
    : "Marginal — longboard day.";
}

function trendIcon(
  delta: number,
  variant: "default" | "zine",
): {
  label: string;
  char: string;
  color: string;
} {
  if (delta >= 5) {
    return {
      label: "building",
      char: "↗",
      color: variant === "zine" ? "text-[#166534]" : "text-emerald-400",
    };
  }
  if (delta <= -5) {
    return {
      label: "dropping",
      char: "↘",
      color: variant === "zine" ? "text-[#9F1239]" : "text-rose-400",
    };
  }
  return {
    label: "holding",
    char: "→",
    color: variant === "zine" ? "text-[#4B453D]" : "text-white/50",
  };
}

export function SevenDayOutlook({
  summary,
  regionName,
  variant = "default",
}: SevenDayOutlookProps) {
  const isZine = variant === "zine";

  if (!summary || summary.days.length === 0) {
    return (
      <section
        aria-labelledby="seven-day-outlook-heading"
        className={
          isZine
            ? "torn torn-tb mb-10 min-w-0 border-2 border-[#11100D] bg-[#FBF6E8] p-4 sm:p-5"
            : "mb-10 min-w-0"
        }
        data-testid="seven-day-outlook"
      >
        <h2
          id="seven-day-outlook-heading"
          className={
            isZine
              ? "mb-4 font-display text-3xl font-black uppercase leading-tight text-[#11100D]"
              : "mb-4 font-[var(--font-heading)] text-2xl font-bold text-white"
          }
        >
          7-Day Region Outlook
        </h2>
        <div
          className={
            isZine
              ? "border-2 border-dashed border-[#11100D]/30 px-5 py-8 text-sm text-[#11100D]/60"
              : "rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-white/60"
          }
        >
          Forecast catching up for {regionName}. Try again in a few.
        </div>
      </section>
    );
  }

  const recommendationsAvailable =
    summary.recommendationAvailability?.state === "available";
  const peakScore = recommendationsAvailable
    ? Math.max(...summary.days.map((d) => d.score))
    : 0;
  const peakIndex = recommendationsAvailable
    ? summary.days.findIndex((d) => d.score === peakScore)
    : -1;

  const arcPoints: SwellArcPoint[] = summary.days.map((d) => ({
    dayOfWeek: d.dayOfWeek,
    dateString: d.dateString,
    waveHeight: d.avgWaveHeight,
    score: d.score,
  }));

  return (
    <section
      aria-labelledby="seven-day-outlook-heading"
      className={
        isZine
          ? "torn torn-tb mb-10 min-w-0 border-2 border-[#11100D] bg-[#FBF6E8] p-4 text-[#11100D] sm:p-5"
          : "mb-10 min-w-0"
      }
      data-testid="seven-day-outlook"
    >
      <h2
        id="seven-day-outlook-heading"
        className={
          isZine
            ? "label-black mb-5 font-display text-2xl font-black uppercase leading-tight"
            : "mb-4 font-[var(--font-heading)] text-2xl font-bold text-white"
        }
      >
        7-Day Region Outlook
      </h2>

      {recommendationsAvailable ? (
        <SwellArc
          points={arcPoints}
          peakIndex={Math.max(0, peakIndex)}
          variant={variant}
        />
      ) : null}

      <ol
        className={
          isZine
            ? "divide-y-2 divide-dashed divide-[#11100D]/30 border-y-2 border-[#11100D] bg-[#FBF6E8]"
            : "divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
        }
      >
        {summary.days.map((day, idx) => {
          const scoreColors = recommendationsAvailable
            ? getScoreColorClasses(day.score)
            : null;
          const waves = formatWaveHeightRange(day.avgWaveHeight);
          const isPeak =
            recommendationsAvailable &&
            day.score === peakScore &&
            peakScore > 0;
          const prevScore = idx > 0 ? summary.days[idx - 1].score : day.score;
          const trend = trendIcon(day.score - prevScore, variant);
          const monthDay = `${day.date.getUTCMonth() + 1}/${day.date.getUTCDate()}`;

          return (
            <li
              key={day.dateString}
              data-testid={`outlook-day-${idx}`}
              data-peak={isPeak ? "true" : undefined}
              className={[
                "relative flex items-center gap-3 px-3 py-4 sm:gap-4 sm:px-5",
                isPeak
                  ? isZine
                    ? "bg-[#FDB84B]/20"
                    : "bg-[#F78E42]/[0.08]"
                  : "",
              ].join(" ")}
            >
              {/* Peak accent — left edge Charming Orange bar */}
              {isPeak ? (
                <span
                  aria-hidden="true"
                  className={
                    isZine
                      ? "absolute inset-x-3 bottom-1 h-1 bg-[#F78E42]"
                      : "absolute inset-y-2 left-0 w-1 rounded-r bg-[#F78E42]"
                  }
                />
              ) : null}

              {/* Day + date */}
              <div className="w-20 shrink-0 sm:w-24">
                <div
                  className={`font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide ${isZine ? "text-[#11100D]" : "text-white"}`}
                >
                  {day.dayOfWeek.slice(0, 3)}
                </div>
                <div
                  className={`font-mono text-xs ${isZine ? "text-[#11100D]/60" : "text-white/50"}`}
                >
                  {monthDay}
                </div>
              </div>

              {/* Score badge */}
              {recommendationsAvailable && scoreColors ? (
                <div className="shrink-0">
                  <span
                    className={[
                      "inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-full px-2 font-mono text-sm font-bold",
                      isZine
                        ? scoreColors.paperBadge
                        : `${scoreColors.bg} text-white`,
                    ].join(" ")}
                    aria-label={`Score ${day.score} out of 100 (${scoreColors.label})`}
                  >
                    {day.score}
                  </span>
                </div>
              ) : null}

              {/* Waves + callout */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span
                    className={`font-[var(--font-heading)] text-base font-semibold ${isZine ? "text-[#11100D]" : "text-white"}`}
                  >
                    {waves}
                  </span>
                  <span
                    className={`font-mono text-xs uppercase tracking-wide ${isZine ? "text-[#11100D]/65" : "text-white/55"}`}
                  >
                    {day.windConditions === "offshore"
                      ? "offshore"
                      : day.windConditions === "light"
                        ? "light wind"
                        : "onshore"}
                  </span>
                </div>
                {recommendationsAvailable ? (
                  <div
                    className={`truncate text-sm ${isZine ? "text-[#11100D]/75" : "text-white/70"}`}
                  >
                    {daySubtitle(day.windConditions, day.score)}
                  </div>
                ) : (
                  <div
                    className={`truncate text-sm ${isZine ? "text-[#11100D]/75" : "text-white/70"}`}
                  >
                    {day.dominantTideStatus
                      ? `${day.dominantTideStatus} tide`
                      : "Tide status pending"}
                  </div>
                )}
              </div>

              {/* Trend dot */}
              {recommendationsAvailable ? (
                <div className="shrink-0 text-right">
                  <span
                    className={`font-mono text-xl ${trend.color}`}
                    aria-label={`Trend ${trend.label} vs previous day`}
                  >
                    {trend.char}
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
