import { CheckCircle2, Clock3, ShieldCheck, Waves } from "lucide-react";

import { FoundingAccessCta } from "@/components/pricing/founding-access-cta";
import { QuiverSticker, type QuiverStickerProps } from "@/components/zine";

const LOOP_STEPS = [
  {
    title: "Forecast",
    body: "Quiver gives one surf call before you head out.",
    sticker: "forecastWaveMark",
    stickerClass: "right-2 top-2 w-20",
    rotation: "-rotate-2",
  },
  {
    title: "Check",
    body: "Surfers compare the call against the real lineup.",
    sticker: "spotWindRead",
    stickerClass: "right-2 top-2 w-20",
    rotation: "rotate-1",
  },
  {
    title: "Log",
    body: "Session notes turn what happened into feedback.",
    sticker: "surfWax",
    stickerClass: "right-2 top-2 w-20",
    rotation: "-rotate-1",
  },
  {
    title: "Adjust",
    body: "The model uses that feedback to make the next call more useful.",
    sticker: "tealCurvedArrow",
    stickerClass: "right-2 top-2 w-20",
    rotation: "rotate-2",
  },
] as const satisfies ReadonlyArray<{
  title: string;
  body: string;
  sticker: QuiverStickerProps["sticker"];
  stickerClass: string;
  rotation: string;
}>;

const STATUS_POINTS = [
  {
    icon: Clock3,
    title: "Plans are not open yet",
    body: "For now, focus on logging sessions. We'll open plans after the 5-session lifetime Pro offer is ready.",
    sticker: "creamTornStrip",
  },
  {
    icon: ShieldCheck,
    title: "Earn Pro for lifetime",
    body: "Log 5 surf sessions in Quiver during founding access to qualify for Pro for lifetime.",
    sticker: "navyTape",
  },
  {
    icon: CheckCircle2,
    title: "Your logs count toward it",
    body: "Each session log helps train the surf-call loop and moves you toward the founding Pro offer.",
    sticker: "goldTape",
  },
] as const satisfies ReadonlyArray<{
  icon: typeof Clock3;
  title: string;
  body: string;
  sticker: QuiverStickerProps["sticker"];
}>;

export function FoundingOfferSurface() {
  return (
    <div
      className="zine-tab bg-[#0D1020] text-white"
      data-testid="founding-offer-zine-surface"
    >
      <section className="relative overflow-hidden px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(37,45,107,0.92),rgba(13,16,32,0.98)_62%)]"
        />
        <div
          aria-hidden
          className="noise-texture-subtle absolute inset-0 opacity-45"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <QuiverSticker
            sticker="halftoneCircle"
            className="absolute -left-10 top-24 w-40 -rotate-12 opacity-45 mix-blend-screen sm:left-8 sm:w-52"
            sizes="13rem"
          />
          <QuiverSticker
            sticker="breakingWave"
            className="absolute -right-24 top-20 hidden w-80 rotate-6 opacity-35 mix-blend-screen md:block"
            sizes="20rem"
          />
          <QuiverSticker
            sticker="blackBrushScrap"
            className="absolute bottom-4 left-[48%] hidden w-28 -rotate-6 opacity-30 mix-blend-multiply md:block"
            sizes="7rem"
          />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div>
            <div className="relative mb-5 inline-flex items-center gap-2 border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#11100D] shadow-[3px_4px_0_rgba(247,142,66,0.55)]">
              <QuiverSticker
                sticker="orangeTape"
                className="absolute -left-8 -top-5 w-24 -rotate-12 opacity-85"
                sizes="6rem"
              />
              <Waves className="h-4 w-4" />
              Founding Access Waitlist
            </div>
            <h1 className="max-w-4xl font-heading text-4xl font-bold leading-tight tracking-normal text-white sm:text-5xl md:text-6xl">
              Join early and help the forecast learn from real sessions.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#B8C7E0]">
              Check one clear surf call before you paddle out. Log 5 sessions,
              help tune the next call, and qualify for Pro for lifetime when
              plans open.
            </p>

            <div className="mt-8">
              <FoundingAccessCta />
            </div>
          </div>

          <div
            className="torn torn-tb relative overflow-hidden border-2 border-[#11100D] bg-[#F4EBD8] text-[#11100D] shadow-[8px_10px_0_rgba(247,142,66,0.22),0_24px_60px_rgba(0,0,0,0.28)]"
            style={{ padding: "48px 24px 56px" }}
          >
            <span className="tape tl" aria-hidden />
            <span className="tape br" aria-hidden />
            <QuiverSticker
              sticker="creamCoastMap"
              className="absolute -right-10 -top-7 w-36 rotate-12 opacity-35"
              sizes="9rem"
            />
            <p className="relative z-10 inline-flex border-2 border-[#11100D] bg-[#11100D] px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest text-[#F4EBD8]">
              Current status
            </p>
            <div className="relative z-10 mt-6 space-y-5">
              {STATUS_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <div key={point.title} className="flex gap-4">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#11100D] bg-[#FBF6E8] text-[#0B3A75] shadow-[2px_3px_0_rgba(17,16,13,0.18)]">
                      <QuiverSticker
                        sticker={point.sticker}
                        className="absolute -right-4 -top-3 w-10 rotate-12 opacity-45"
                        sizes="2.5rem"
                      />
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-heading text-base font-semibold text-[#11100D]">
                        {point.title}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-[#4B4030]">
                        {point.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-white/10 bg-[#121832] px-4 py-12 sm:px-6 lg:px-8">
        <QuiverSticker
          sticker="navyLightning"
          className="pointer-events-none absolute right-6 top-8 hidden w-28 rotate-12 opacity-40 md:block"
          sizes="7rem"
        />
        <QuiverSticker
          sticker="goldDownArrow"
          className="pointer-events-none absolute bottom-8 left-6 hidden w-16 -rotate-6 opacity-45 md:block"
          sizes="4rem"
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-8 max-w-2xl">
            <p className="inline-flex border-2 border-[#11100D] bg-[#7BDCB5] px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest text-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.24)]">
              How Quiver gets better
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-normal text-white">
              Forecast, check, log, adjust.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {LOOP_STEPS.map((step, index) => (
              <div
                key={step.title}
                className={`torn torn-tb group relative min-h-56 overflow-hidden border-2 border-[#11100D] bg-[#F4EBD8] p-5 text-[#11100D] shadow-[4px_5px_0_rgba(17,16,13,0.28)] transition-transform duration-200 hover:-translate-y-1 ${step.rotation}`}
                data-testid="pricing-loop-card"
              >
                <QuiverSticker
                  sticker={step.sticker}
                  className={`absolute rotate-12 opacity-85 transition-transform duration-200 group-hover:scale-105 ${step.stickerClass}`}
                  sizes="6rem"
                />
                <QuiverSticker
                  sticker={index % 2 === 0 ? "creamTape" : "tealTape"}
                  className="absolute -left-8 -top-4 w-24 -rotate-12 opacity-85"
                  sizes="6rem"
                />
                <div className="relative z-10 mb-5 flex h-10 w-10 items-center justify-center border-2 border-[#11100D] bg-[#F78E42] font-mono text-sm font-bold text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.2)]">
                  {index + 1}
                </div>
                <h3 className="relative z-10 font-heading text-xl font-semibold uppercase tracking-normal text-[#11100D]">
                  {step.title}
                </h3>
                <p className="relative z-10 mt-3 text-sm leading-6 text-[#4B4030]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
