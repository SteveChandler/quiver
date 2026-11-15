"use client";

import * as React from "react";

import { formatDuration, formatFeet, formatMetres, formatStationDay, formatStationTime } from "@/lib/tide-stations/format";
import { localDateKey, tideStateAt, type TideExtremePoint } from "@/lib/tide-stations/series";

interface TideStationNowProps {
  extremes: TideExtremePoint[];
  timeZone: string;
  /** Render time of the cached page; the first client render matches it, then moves to the real clock. */
  renderedAtMs: number;
  /** What the heights are when they are not the source's plain prediction. */
  heightNote?: string | null;
  /**
   * Show the shape of the day: dim the tides that have passed, mark the next
   * one and the day's main high, and say so when the next high is a small one.
   * On a mixed tide the next pair alone can read flat while the main high was hours ago.
   */
  showDayShape?: boolean;
}

const MINUTE_MS = 60_000;

/** A day's main high, when the day has more than one high. */
function mainHighOf(today: TideExtremePoint[]): TideExtremePoint | null {
  const highs = today.filter((e) => e.type === "high");
  if (highs.length < 2) return null;
  return highs.reduce((top, e) => (e.heightM > top.heightM ? e : top));
}

/**
 * "Today 0.3–1.5 ft · main high 6:26 AM. The next high is a small bump." when the next
 * high is today and under half the main high; otherwise null.
 */
export function smallHighLine(
  today: TideExtremePoint[],
  next: TideExtremePoint | null,
  timeZone: string
): string | null {
  const main = mainHighOf(today);
  if (!main || !next || next.type !== "high" || next.ts === main.ts) return null;
  if (!today.some((e) => e.ts === next.ts)) return null;
  if (next.heightM >= main.heightM / 2) return null;
  const heights = today.map((e) => e.heightM);
  const range = `${formatFeet(Math.min(...heights)).replace(" ft", "")}–${formatFeet(Math.max(...heights))}`;
  return `Today ${range} · main high ${formatStationTime(main.ts, timeZone)}. The next high is a small bump.`;
}

export function TideStationNow({ extremes, timeZone, renderedAtMs, heightNote, showDayShape = false }: TideStationNowProps) {
  const [nowMs, setNowMs] = React.useState(renderedAtMs);

  React.useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const state = tideStateAt(extremes, nowMs);
  const todayKey = localDateKey(nowMs, timeZone);
  const today = extremes.filter((e) => localDateKey(e.ts, timeZone) === todayKey);
  // The time alone reads as today; a next tide after midnight needs its day.
  const nextDay =
    state && localDateKey(state.next.ts, timeZone) !== todayKey
      ? `${formatStationDay(state.next.ts, timeZone).split(",")[0]} `
      : "";
  const mainHigh = showDayShape ? mainHighOf(today) : null;
  const rangeLine = showDayShape ? smallHighLine(today, state?.next ?? null, timeZone) : null;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]" data-testid="tide-station-now">
      <div className="border-2 border-[#11100D] bg-[#FBF6E8] p-4 shadow-[4px_4px_0_rgba(17,16,13,0.75)]">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5E00]">Right now</p>
        {state ? (
          <>
            <p className="mt-2 font-heading text-3xl font-bold text-[#11100D]">
              {state.direction === "rising" ? "Rising" : "Falling"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#11100D]/80">
              Next {state.next.type} {nextDay}
              {formatStationTime(state.next.ts, timeZone)},{" "}
              <span className="font-mono">{formatFeet(state.next.heightM)}</span>{" "}
              <span className="text-[#11100D]/60">({formatMetres(state.next.heightM)})</span>, in{" "}
              {formatDuration(Date.parse(state.next.ts) - nowMs)}.
            </p>
            {rangeLine && (
              <p className="mt-2 border-t border-dashed border-[#11100D]/30 pt-2 text-sm text-[#11100D]" data-testid="tide-day-range">
                {rangeLine}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-[#11100D]/70">No upcoming tide in this table. Check back after the next update.</p>
        )}
      </div>

      <div className="border-2 border-[#11100D] bg-[#FBF6E8] p-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5E00]">
          Today · {formatStationDay(nowMs, timeZone)}
        </p>
        {today.length ? (
          <ul className="mt-2 divide-y divide-[#11100D]/15">
            {today.map((extreme) => {
              const isPast = showDayShape && Date.parse(extreme.ts) <= nowMs;
              const isNext = showDayShape && state?.next.ts === extreme.ts;
              const isMain = mainHigh?.ts === extreme.ts;
              return (
                <li
                  key={extreme.ts}
                  className={`flex items-baseline justify-between gap-3 py-2 text-sm ${
                    isPast ? "opacity-60" : ""
                  } ${isNext ? "-ml-2 pl-2 shadow-[inset_3px_0_0_#F78E42]" : ""}`}
                  data-tide-row={isNext ? "next" : isPast ? "past" : undefined}
                >
                  <span className="font-semibold uppercase text-[#11100D]">{extreme.type === "high" ? "High" : "Low"}</span>
                  <span className="whitespace-nowrap font-mono text-[#11100D]">{formatStationTime(extreme.ts, timeZone)}</span>
                  <span className="font-mono text-[#11100D]">
                    <span
                      className={isMain ? "bg-[#F6E9CE] px-1 outline outline-[1.5px] outline-[#8A5E00]" : undefined}
                      title={isMain ? "Main high of the day" : undefined}
                    >
                      {formatFeet(extreme.heightM)}
                    </span>{" "}
                    <span className="text-[#11100D]/60">{formatMetres(extreme.heightM)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#11100D]/70">no data</p>
        )}
        {heightNote && <p className="mt-2 text-[11px] leading-snug text-[#11100D]/65">{heightNote}</p>}
      </div>
    </div>
  );
}
