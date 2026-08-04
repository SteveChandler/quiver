import {
  CURATED_SESSION_OUTCOME,
  getContender,
} from "@/lib/forecast-accuracy/curated-comparison";

function formatMeters(meters: number): string {
  return meters.toFixed(2) + "m";
}

export function SessionOutcomeProof() {
  const quiver = getContender("quiver");
  const surfline = getContender("surfline");
  const {
    satisfactionPct,
    goodRatingLabel,
    windowLabel,
    beaches,
  } = CURATED_SESSION_OUTCOME;

  return (
    <section
      aria-labelledby="session-outcome-heading"
      className="relative overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#11100D] p-5 shadow-[4px_4px_0_#F78E42] md:p-7"
    >
      <p className="mb-3 inline-flex rotate-[-1.5deg] rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_#F4EBD8]">
        Two receipts. One app.
      </p>
      <h2
        id="session-outcome-heading"
        className="max-w-4xl font-heading text-3xl font-black leading-[0.95] text-[#F4EBD8] md:text-5xl"
      >
        Tighter than Surfline.{" "}
        <span className="text-[#6EE7B7]">100% good sessions</span> at three
        breaks.
      </h2>
      <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-[#D8E8F7]">
        Quiver posted the lower average wave-height miss. At Ala Moana Bowls,
        Malibu First Point, and Terramar Point, every rated session in our latest
        snapshot came back {goodRatingLabel}.
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="-rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] p-5 text-[#11100D] shadow-[3px_3px_0_#F4EBD8]">
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em]">
            Forecast receipt
          </p>
          <p className="mt-3 font-mono text-6xl font-black leading-none">
            {formatMeters(quiver.maeMeters)}
          </p>
          <p className="mt-2 text-sm font-black">Quiver average miss</p>
          <p className="mt-4 border-t-2 border-[#11100D]/30 pt-3 text-sm font-bold">
            Surfline: {formatMeters(surfline.maeMeters)}. Lower wins.
          </p>
        </div>

        <div className="rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#6EE7B7] p-5 text-[#11100D] shadow-[3px_3px_0_#F4EBD8]">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs font-black uppercase tracking-[0.18em]">
                Session receipt
              </p>
              <p className="mt-2 font-mono text-6xl font-black leading-none">
                {satisfactionPct}%
              </p>
            </div>
            <p className="max-w-52 text-sm font-black sm:text-right">
              of rated sessions at these breaks were good
            </p>
          </div>

          <ul className="mt-5 grid gap-2 sm:grid-cols-3">
            {beaches.map((beach) => (
              <li
                key={beach.name}
                className="rounded-[6px] border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-3 font-heading text-sm font-black leading-tight shadow-[2px_2px_0_#11100D]"
              >
                {beach.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#F4EBD8]/70">
        Saved Quiver session ratings · {windowLabel} · Good = {goodRatingLabel}
      </p>
    </section>
  );
}
