import { Activity, Database, Waves } from "lucide-react";

import { QuiverSticker } from "@/components/zine/quiver-sticker";
import { CURATED_ACCURACY } from "@/lib/forecast-accuracy/curated-comparison";

function formatCount(n: number): string {
  return `${n.toLocaleString("en-US")}+`;
}

export function AccuracyHero() {
  const { vsNoaaImprovementPct, validatedReadings, beachCount } =
    CURATED_ACCURACY;

  return (
    <header className="relative mb-8 overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-4 text-[#11100D] shadow-[4px_4px_0_#11100D] md:p-6">
      <QuiverSticker
        sticker="forecastWaveMark"
        className="absolute -right-12 -top-12 h-36 w-36 rotate-12 object-contain opacity-15 md:h-44 md:w-44"
        sizes="176px"
      />
      <div className="pointer-events-none absolute bottom-4 left-5 hidden font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#5F5646] md:block">
        checked against the buoys
      </div>

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <div className="rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] p-5 text-[#F4EBD8] shadow-[3px_3px_0_#11100D] md:p-7">
          <div className="mb-4 inline-flex rotate-[-1.5deg] items-center gap-2 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <Waves className="h-3.5 w-3.5" aria-hidden />
            Buoy checked
          </div>
          <h1 className="max-w-3xl font-heading text-5xl font-black leading-[0.9] text-[#F4EBD8] md:text-7xl">
            The forecast that learns what you like.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#D8E8F7] md:text-lg">
            Surfline rates the day for the average surfer. Quiver learns your
            taste from the sessions you log and matches every forecast to it —
            on top of wave-height forecasts that beat Surfline and lap NOAA. For
            free.
          </p>
        </div>

        <div className="flex rotate-1 flex-col justify-between rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-5 shadow-[3px_3px_0_#11100D]">
          <div className="rounded-[8px] border-2 border-[#11100D] bg-[#8AB4F8] px-4 py-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">
              Quiver vs NOAA
            </p>
            <p className="mt-1 font-mono text-6xl font-black leading-none">
              {vsNoaaImprovementPct}%
            </p>
            <p className="mt-2 text-sm font-black">
              less wave-height error
            </p>
            <p className="mt-3 text-xs font-bold opacity-70">
              More than twice as sharp as the raw NOAA marine forecast.
            </p>
          </div>

          <div className="mt-5 -rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] px-4 py-3 text-[#F4EBD8]">
            <p className="text-sm font-bold">
              <span className="font-mono text-lg font-black text-[#6EE7B7]">
                Tighter
              </span>{" "}
              than Surfline, too — for free.
            </p>
          </div>
        </div>
      </div>

      <dl className="relative mt-5 grid gap-3 sm:grid-cols-3">
        <div className="-rotate-1 flex items-center gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-3 shadow-[3px_3px_0_#11100D]">
          <Database className="h-5 w-5 text-[#008A7A]" aria-hidden="true" />
          <div>
            <dt className="text-xs font-bold uppercase text-[#5F5646]">
              Beaches tracked
            </dt>
            <dd className="font-mono text-xl font-black text-[#11100D]">
              {formatCount(beachCount)}
            </dd>
          </div>
        </div>
        <div className="rotate-1 flex items-center gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-3 shadow-[3px_3px_0_#11100D]">
          <Activity className="h-5 w-5 text-[#C0521B]" aria-hidden="true" />
          <div>
            <dt className="text-xs font-bold uppercase text-[#5F5646]">
              Buoy readings
            </dt>
            <dd className="font-mono text-xl font-black text-[#11100D]">
              {formatCount(validatedReadings)}
            </dd>
          </div>
        </div>
        <div className="-rotate-1 flex items-center gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-3 shadow-[3px_3px_0_#11100D]">
          <Waves className="h-5 w-5 text-[#0B3A75]" aria-hidden="true" />
          <div>
            <dt className="text-xs font-bold uppercase text-[#5F5646]">
              Vs NOAA
            </dt>
            <dd className="font-mono text-xl font-black text-[#11100D]">
              {vsNoaaImprovementPct}% better
            </dd>
          </div>
        </div>
      </dl>
    </header>
  );
}
