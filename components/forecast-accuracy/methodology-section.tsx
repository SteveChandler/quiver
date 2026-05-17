/**
 * MethodologySection
 *
 * Server component: static content explaining how Quiver's ML bias
 * correction pipeline works and how accuracy is measured.
 */

export function MethodologySection() {
  return (
    <section aria-label="Forecast accuracy methodology" className="relative">
      <div className="rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-5 shadow-[4px_4px_0_#11100D] md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_#11100D]">
              How to read it
            </p>
            <h2 className="font-heading text-2xl font-black text-[#11100D]">
              Three checks, no mystery math.
            </h2>
          </div>
          <p className="max-w-md text-sm font-semibold leading-6 text-[#5F5646]">
            MAE means average wave-height miss. Lower is better.
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
              Use the raw marine forecast a surfer could check anywhere.
            </p>
          </li>
          <li className="rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <span className="font-mono text-xs font-black uppercase tracking-[0.18em]">
              02 correction
            </span>
            <h3 className="mt-3 font-heading text-xl font-black">
              Tune per beach
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6">
              Account for exposure, swell direction, shelter, and local shape.
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
              Compare both forecasts to IOOS buoy observations within 3 hours.
            </p>
          </li>
        </ol>
      </div>
    </section>
  );
}
