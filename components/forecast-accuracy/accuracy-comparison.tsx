/**
 * AccuracyComparison
 *
 * Server component: the centerpiece head-to-head. Renders Quiver vs Surfline
 * vs NOAA average wave-height error (MAE, meters) as horizontal bars. Lower is
 * better, so Quiver's bar is the shortest and is highlighted as the winner.
 * Pure static markup from the curated constant — no data fetch.
 */

import { CURATED_ACCURACY } from "@/lib/forecast-accuracy/curated-comparison";

const MAX_MAE = Math.max(
  ...CURATED_ACCURACY.contenders.map((c) => c.maeMeters),
);

function formatMeters(m: number): string {
  return `${m.toFixed(2)}m`;
}

export function AccuracyComparison() {
  const { contenders, vsNoaaImprovementPct } = CURATED_ACCURACY;

  return (
    <section aria-label="Quiver vs Surfline vs NOAA forecast accuracy">
      <div className="relative overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-5 shadow-[4px_4px_0_#11100D] md:p-7">
        <p className="mb-2 inline-flex rotate-[-1.5deg] rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_#11100D]">
          The tale of the tape
        </p>
        <h2 className="font-heading text-2xl font-black leading-tight text-[#11100D] md:text-3xl">
          More accurate than Surfline. Twice as sharp as NOAA.
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5F5646]">
          Average wave-height miss versus real buoy readings, in meters. Shorter
          bar means a tighter forecast.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {contenders.map((c) => {
            const widthPct = Math.max(8, (c.maeMeters / MAX_MAE) * 100);
            const isQuiver = c.highlight === true;
            return (
              <div key={c.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span
                    className={`font-heading text-sm font-black uppercase tracking-[0.08em] ${
                      isQuiver ? "text-[#11100D]" : "text-[#5F5646]"
                    }`}
                  >
                    {c.label}
                    {isQuiver && (
                      <span className="ml-2 inline-flex rotate-[-2deg] rounded-[4px] border-2 border-[#11100D] bg-[#34d399] px-1.5 py-0.5 text-[10px] font-black tracking-[0.12em] text-[#11100D]">
                        WINNER
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-mono text-sm font-black ${
                      isQuiver ? "text-[#11100D]" : "text-[#5F5646]"
                    }`}
                  >
                    {formatMeters(c.maeMeters)}
                  </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-[4px] border-2 border-[#11100D] bg-[#EFE5CF]">
                  <div
                    className="flex h-full items-center justify-end rounded-r-[2px] pr-2"
                    style={{ width: `${widthPct}%`, backgroundColor: c.color }}
                    role="img"
                    aria-label={`${c.label} mean absolute error ${formatMeters(
                      c.maeMeters,
                    )}`}
                  >
                    {isQuiver && (
                      <span className="font-mono text-xs font-black text-[#11100D]">
                        lowest error
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="rotate-[-0.5deg] rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] px-4 py-3 text-sm font-bold text-[#F4EBD8] shadow-[3px_3px_0_#11100D]">
            Quiver cuts wave-height error{" "}
            <span className="font-mono font-black text-[#6EE7B7]">
              {vsNoaaImprovementPct}%
            </span>{" "}
            versus the NOAA baseline — and comes in tighter than Surfline.
          </p>
          <a
            href="#methodology"
            className="shrink-0 self-start font-mono text-xs font-black uppercase tracking-[0.12em] text-[#9E5010] hover:underline sm:self-center"
          >
            How we measure →
          </a>
        </div>

        <p className="mt-4 text-center text-xs font-semibold text-[#5F5646]">
          Lower is better. Mean absolute error vs nearby buoy observations.
        </p>
      </div>
    </section>
  );
}
