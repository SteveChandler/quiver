/**
 * Explains why offshore buoy height and breaking wave face height cannot be
 * treated as interchangeable ground truth.
 */
export function AccuracyComparison() {
  return (
    <section aria-labelledby="wave-height-definitions-heading">
      <div className="relative overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-5 shadow-[4px_4px_0_#11100D] md:p-7">
        <p className="mb-2 inline-flex rotate-[-1.5deg] rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_#11100D]">
          Same words, different water
        </p>
        <h2
          id="wave-height-definitions-heading"
          className="font-heading text-2xl font-black leading-tight text-[#11100D] md:text-3xl"
        >
          Offshore wave height is not breaking face height.
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5F5646]">
          A buoy and a surfer can both report “wave height” while measuring
          different physical quantities. A valid score has to keep that
          distinction visible.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="-rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#8AB4F8] p-5 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <p className="font-mono text-xs font-black uppercase tracking-[0.16em]">
              Buoy observation
            </p>
            <h3 className="mt-2 font-heading text-2xl font-black">
              Significant wave height offshore
            </h3>
            <p className="mt-3 text-sm font-semibold leading-6">
              IOOS and NOAA buoys estimate significant wave height, often
              written as Hs. It describes the offshore sea state around the
              sensor, not the face of a wave breaking at a beach.
            </p>
          </article>

          <article className="rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-5 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <p className="font-mono text-xs font-black uppercase tracking-[0.16em]">
              Surf observation
            </p>
            <h3 className="mt-2 font-heading text-2xl font-black">
              Breaking face height at the beach
            </h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#5F5646]">
              The wave a surfer sees depends on bathymetry, exposure,
              refraction, tide, and where it breaks. It cannot be scored
              directly against offshore Hs without a documented conversion and
              on-beach observations.
            </p>
          </article>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] px-4 py-3 text-sm font-bold text-[#F4EBD8] shadow-[3px_3px_0_#11100D]">
            A buoy check can validate an offshore-height forecast. By itself, it
            cannot prove the breaking surf-height call was right.
          </p>
          <a
            href="#methodology"
            className="shrink-0 self-start font-mono text-xs font-black uppercase tracking-[0.12em] text-[#9E5010] hover:underline sm:self-center"
          >
            See the method →
          </a>
        </div>
      </div>
    </section>
  );
}
