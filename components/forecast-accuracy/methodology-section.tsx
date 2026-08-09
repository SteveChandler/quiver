/**
 * Static methodology for evaluating Quiver or any other surf forecast.
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
              A fair test
            </p>
            <h2 className="font-heading text-2xl font-black text-[#11100D]">
              Measure the same thing on the same sample.
            </h2>
          </div>
          <p className="max-w-md text-sm font-semibold leading-6 text-[#5F5646]">
            Mean absolute error can summarize the average miss, but the number
            is only comparable when the inputs follow the same rules.
          </p>
        </div>

        <ol className="grid gap-3 md:grid-cols-3">
          <li className="-rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <span className="font-mono text-xs font-black uppercase tracking-[0.18em]">
              01 save
            </span>
            <h3 className="mt-3 font-heading text-xl font-black">
              Freeze the forecast
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6">
              Store the forecast before the observation arrives, including its
              issue time, valid time, location, lead time, variable, and units.
              Do not backfill a revised value.
            </p>
          </li>
          <li className="rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <span className="font-mono text-xs font-black uppercase tracking-[0.18em]">
              02 match
            </span>
            <h3 className="mt-3 font-heading text-xl font-black">
              Pair the observation
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6">
              Match the saved value to the nearest defensible observation in a
              fixed time window. For automated wave-height checks, Quiver uses
              time-matched readings from nearby IOOS and NOAA buoys.
            </p>
          </li>
          <li className="-rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#8AB4F8] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <span className="font-mono text-xs font-black uppercase tracking-[0.18em]">
              03 report
            </span>
            <h3 className="mt-3 font-heading text-xl font-black">
              Publish the limits
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6">
              Report sample size, beaches, date range, forecast horizon, missing
              data, and the exact error formula. Separate offshore Hs checks
              from breaking-wave observations.
            </p>
          </li>
        </ol>

        <div className="mt-5 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] p-4 text-[#F4EBD8] shadow-[3px_3px_0_#11100D]">
            <h3 className="font-heading text-xl font-black">
              What a head-to-head requires
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#D8E8F7]">
              Every forecast must cover the same beaches, valid times, lead
              times, observations, wave-height definition, and exclusion rules.
              Different samples can describe different conditions and reverse
              the apparent result.
            </p>
          </div>
          <div className="rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <h3 className="font-heading text-xl font-black">
              What Quiver can claim today
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5F5646]">
              Quiver has not completed that same-sample comparison against
              Surfline, NOAA, or another surf forecast. We therefore do not
              claim that Quiver ranks first on accuracy.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
