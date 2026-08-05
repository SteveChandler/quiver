import { ClipboardCheck, Ruler, Waves } from "lucide-react";

import { QuiverSticker } from "@/components/zine/quiver-sticker";

const METHOD_CHECKS = [
  {
    label: "Forecast",
    detail: "Save the value, place, valid time, lead time, and units.",
    icon: ClipboardCheck,
    color: "text-[#008A7A]",
  },
  {
    label: "Observation",
    detail:
      "Match it to a later reading from a defensible ground-truth source.",
    icon: Waves,
    color: "text-[#C0521B]",
  },
  {
    label: "Definition",
    detail: "Confirm both values describe the same physical quantity.",
    icon: Ruler,
    color: "text-[#0B3A75]",
  },
] as const;

export function AccuracyHero() {
  return (
    <header className="relative mb-8 overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-4 text-[#11100D] shadow-[4px_4px_0_#11100D] md:p-6">
      <QuiverSticker
        sticker="forecastWaveMark"
        className="absolute -right-12 -top-12 h-36 w-36 rotate-12 object-contain opacity-15 md:h-44 md:w-44"
        sizes="176px"
      />

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <div className="rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] p-5 text-[#F4EBD8] shadow-[3px_3px_0_#11100D] md:p-7">
          <div className="mb-4 inline-flex rotate-[-1.5deg] items-center gap-2 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <Waves className="h-3.5 w-3.5" aria-hidden />
            Start with the measurement
          </div>
          <h1 className="max-w-3xl font-heading text-5xl font-black leading-[0.9] text-[#F4EBD8] md:text-7xl">
            How to judge a surf forecast.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#D8E8F7] md:text-lg">
            A useful accuracy claim names the forecast variable, saves the
            prediction before conditions arrive, and checks it against the
            matching observation. If those pieces differ, the score does not
            support a ranking.
          </p>
        </div>

        <div className="flex rotate-1 flex-col justify-between rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-5 shadow-[3px_3px_0_#11100D]">
          <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-[#5F5646]">
            Quiver&apos;s current position
          </p>
          <p className="mt-3 font-heading text-3xl font-black leading-tight text-[#11100D]">
            No same-sample comparison. No accuracy ranking.
          </p>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#5F5646]">
            Quiver has not evaluated other surf forecasts on the same beaches,
            timestamps, lead times, and wave-height definitions. This page
            explains the method we expect any comparison to meet.
          </p>
        </div>
      </div>

      <dl className="relative mt-5 grid gap-3 sm:grid-cols-3">
        {METHOD_CHECKS.map((check, index) => {
          const Icon = check.icon;
          return (
            <div
              key={check.label}
              className={`${index % 2 === 0 ? "-rotate-1" : "rotate-1"} flex items-start gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-3 shadow-[3px_3px_0_#11100D]`}
            >
              <Icon className={`mt-0.5 h-5 w-5 ${check.color}`} aria-hidden />
              <div>
                <dt className="font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D]">
                  {check.label}
                </dt>
                <dd className="mt-1 text-xs font-semibold leading-5 text-[#5F5646]">
                  {check.detail}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </header>
  );
}
