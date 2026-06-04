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
              NOAA baseline MAE uses the raw marine forecast before Quiver
              applies beach-level correction.
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
              Quiver MAE uses the corrected forecast after local exposure,
              swell direction, shelter, and spot-shape signals are applied.
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
              Quiver trusts the comparison only after matching forecast rows to
              IOOS or NOAA buoy observations inside the validation window.
            </p>
          </li>
        </ol>

        <div className="mt-5 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] p-4 text-[#F4EBD8] shadow-[3px_3px_0_#11100D]">
            <h3 className="font-heading text-xl font-black">
              When the page claims lift
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#D8E8F7]">
              Quiver only says it beat the NOAA baseline when Quiver MAE is
              lower, at least 10 validated forecast-buoy pairs exist, and the
              row has a real last-updated timestamp. Otherwise the page shows
              building status or no measurable lift yet.
            </p>
          </div>
          <div className="rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <h3 className="font-heading text-xl font-black">Known limits</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5F5646]">
              Nearby buoys are not perfect proxies for every break. Sparse
              samples can move quickly in a rolling window, and NOAA is a
              regional marine baseline, not a spot-specific competitor product.
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-[#5F5646]">
          Last updated appears on the live report summary and each qualifying
          beach row.
        </p>
      </div>
    </section>
  );
}
