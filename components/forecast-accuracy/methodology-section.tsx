/**
 * MethodologySection
 *
 * Server component: static content explaining how the head-to-head is scored —
 * NOAA baseline, the Surfline benchmark, and buoy validation.
 */

export function MethodologySection() {
  return (
    <section
      id="methodology"
      aria-label="Forecast accuracy methodology"
      className="relative scroll-mt-24"
    >
      <div className="rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-5 shadow-[4px_4px_0_#11100D] md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_#11100D]">
              How to read it
            </p>
            <h2 className="font-heading text-2xl font-black text-[#11100D]">
              Three checks, then a plain score.
            </h2>
          </div>
          <p className="max-w-md text-sm font-semibold leading-6 text-[#5F5646]">
            MAE means average wave-height miss in meters. Lower is better.
          </p>
        </div>

        <ol className="grid gap-3 md:grid-cols-3">
          <li className="-rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <span className="font-mono text-xs font-black uppercase tracking-[0.18em]">
              01 baseline
            </span>
            <h3 className="mt-3 font-heading text-xl font-black">
              Start with NOAA
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6">
              The raw National Weather Service marine forecast — the regional
              read any surfer can pull from weather.gov, free.
            </p>
          </li>
          <li className="rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <span className="font-mono text-xs font-black uppercase tracking-[0.18em]">
              02 benchmark
            </span>
            <h3 className="mt-3 font-heading text-xl font-black">
              Add Surfline
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6">
              The paid industry standard, so the comparison is against the best
              forecast most surfers actually pay for — not a strawman.
            </p>
          </li>
          <li className="-rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#8AB4F8] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <span className="font-mono text-xs font-black uppercase tracking-[0.18em]">
              03 receipts
            </span>
            <h3 className="mt-3 font-heading text-xl font-black">
              Check the buoys
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6">
              Every forecast is matched to real IOOS and NOAA buoy readings.
              Lowest average miss wins. Quiver wins.
            </p>
          </li>
        </ol>

        <div className="mt-5 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] p-4 text-[#F4EBD8] shadow-[3px_3px_0_#11100D]">
            <h3 className="font-heading text-xl font-black">
              Why Quiver lands tighter
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#D8E8F7]">
              NOAA publishes broad regional forecasts that ignore individual
              beach geography. Quiver tunes each break with local exposure,
              swell direction, shelter, and spot shape — so the number you see
              tracks the wave that actually shows up.
            </p>
          </div>
          <div className="rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <h3 className="font-heading text-xl font-black">Honest about it</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5F5646]">
              Nearby buoys aren&apos;t perfect proxies for every break, and NOAA
              is a regional marine baseline. We still put our number on the wall,
              right next to the competition.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
