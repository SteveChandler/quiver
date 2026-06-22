/**
 * PersonalFitSection
 *
 * Server component: the lead differentiator. Surfline rates the average
 * surfer's day; Quiver learns what YOU like from logged sessions and matches
 * forecasts to your taste. Headlines the real Match Score concordance number.
 */

import { CURATED_MATCH } from "@/lib/forecast-accuracy/curated-comparison";

export function PersonalFitSection() {
  const { concordancePct, comparablePairs } = CURATED_MATCH;

  return (
    <section aria-label="Personalized surf match accuracy">
      <div className="relative overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#252D6B] p-5 text-[#F4EBD8] shadow-[4px_4px_0_#11100D] md:p-7">
        <p className="mb-2 inline-flex rotate-[-1.5deg] rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_#11100D]">
          The whole point
        </p>
        <h2 className="font-heading text-3xl font-black leading-[0.95] text-[#F4EBD8] md:text-4xl">
          Surfline rates the day.
          <br />
          Quiver rates <span className="text-[#F78E42]">your</span> day.
        </h2>
        <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#D8E8F7]">
          A 3-star day for the average surfer can be the best session of your
          month — your board, your skill, your wind, your tolerance for crowds.
          Surfline&apos;s rating is the room&apos;s average. Quiver learns what{" "}
          <em className="not-italic font-black text-[#F4EBD8]">you</em> like from
          every session you log, then matches each forecast to your taste.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
          <div className="rounded-[8px] border-2 border-[#11100D] bg-[#8AB4F8] px-5 py-5 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">
              Match Score vs your own rating
            </p>
            <p className="mt-1 font-mono text-6xl font-black leading-none">
              {concordancePct}%
            </p>
            <p className="mt-2 text-sm font-black">
              agreement on which day was better
            </p>
            <p className="mt-3 text-xs font-bold opacity-70">
              When Quiver scores one day a stronger personal match than another,
              it&apos;s the one you rated higher about 3 times out of 4.
            </p>
          </div>

          <ul className="flex flex-col gap-2.5">
            {[
              "Rate a few sessions and the match gets personal — it learns your wave height, wind, and board fit.",
              "It also learns what you avoid, so junk days for you get marked down even when the spot looks “good.”",
              "Every log sharpens the next call. Surfline can’t do that — it doesn’t know you.",
            ].map((line, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] px-4 py-3 text-sm font-semibold leading-6 text-[#D8E8F7] shadow-[3px_3px_0_#11100D]"
              >
                <span className="font-mono text-xs font-black text-[#F78E42]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-xs font-semibold text-[#D8E8F7]/70">
          Concordance measured across {comparablePairs.toLocaleString("en-US")}{" "}
          pairs of logged, rated sessions. The more you log, the sharper your
          match gets.
        </p>
      </div>
    </section>
  );
}
