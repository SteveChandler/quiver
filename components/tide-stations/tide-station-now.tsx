"use client";

import * as React from "react";

import { formatDuration, formatFeet, formatMetres, formatStationDay, formatStationTime } from "@/lib/tide-stations/format";
import { localDateKey, tideStateAt, type TideExtremePoint } from "@/lib/tide-stations/series";

interface TideStationNowProps {
  extremes: TideExtremePoint[];
  timeZone: string;
  /** Render time of the cached page; the first client render matches it, then moves to the real clock. */
  renderedAtMs: number;
}

const MINUTE_MS = 60_000;

export function TideStationNow({ extremes, timeZone, renderedAtMs }: TideStationNowProps) {
  const [nowMs, setNowMs] = React.useState(renderedAtMs);

  React.useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const state = tideStateAt(extremes, nowMs);
  const todayKey = localDateKey(nowMs, timeZone);
  const today = extremes.filter((e) => localDateKey(e.ts, timeZone) === todayKey);

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
              Next {state.next.type} {formatStationTime(state.next.ts, timeZone)},{" "}
              <span className="font-mono">{formatFeet(state.next.heightM)}</span>{" "}
              <span className="text-[#11100D]/60">({formatMetres(state.next.heightM)})</span>, in{" "}
              {formatDuration(Date.parse(state.next.ts) - nowMs)}.
            </p>
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
            {today.map((extreme) => (
              <li key={extreme.ts} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="font-semibold uppercase text-[#11100D]">{extreme.type === "high" ? "High" : "Low"}</span>
                <span className="font-mono text-[#11100D]">{formatStationTime(extreme.ts, timeZone)}</span>
                <span className="font-mono text-[#11100D]">
                  {formatFeet(extreme.heightM)} <span className="text-[#11100D]/60">{formatMetres(extreme.heightM)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#11100D]/70">no data</p>
        )}
      </div>
    </div>
  );
}
