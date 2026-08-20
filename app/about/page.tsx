import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { ABOUT_CONTENT } from "@/lib/constants/content";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { AboutCtaButtons } from "./about-cta-buttons";

// ISR: Revalidate every 1 hour (static content, rarely changes)
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "I built Quiver because I was tired of forecasts being wrong.",
  description:
    "I built Quiver because I was tired of forecasts being wrong. See why Quiver puts live buoy, wind, tide, and beach context in one surf forecast app.",
  path: "/about",
  keywords: [
    "about Quiver",
    "surf forecast app",
    "surf data",
    "surf conditions",
    "real surf data",
  ],
});

export default function AboutPage() {
  const { hero, problem, solution, whatsNext, cta } = ABOUT_CONTENT;

  return (
    <ZineSurface sectionLabel="Field notes" editionLabel="Why I built this">
      <main>
        {/* Hero — the founder's why */}
        <header className="relative">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -top-8 right-6 hidden w-36 rotate-6 opacity-85 sm:block"
          />
          <ScrollReveal>
            <p className="label-black mb-5">From the founder</p>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <h1 className="zine-h1 max-w-5xl break-words font-black uppercase leading-[0.9] tracking-normal text-[#11100D] [text-wrap:balance]">
              {hero.title}
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={160}>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
              {hero.subtitle}
            </p>
          </ScrollReveal>
        </header>

        {/* The Problem — handwritten notebook confession */}
        <ScrollReveal>
          <section className="mt-12">
            <p className="typewriter mb-3">Before Quiver</p>
            <div className="notebook space-y-5">
              {problem.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="text-base leading-relaxed text-[#11100D]/80 sm:text-lg"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* What Quiver Actually Does */}
        <section className="mt-14" aria-labelledby="solution-heading">
          <ScrollReveal>
            <div className="mb-6 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
              <div>
                <p className="typewriter mb-2">So I built something different</p>
                <h2
                  id="solution-heading"
                  className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
                >
                  Real data, and a way to talk back
                </h2>
              </div>
              <QuiverSticker
                sticker="spotSwellMatch"
                className="hidden w-16 rotate-6 drop-shadow-sm sm:block"
              />
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <p className="max-w-3xl text-base leading-relaxed text-[#11100D]/78 sm:text-lg">
              {solution.intro}
            </p>
          </ScrollReveal>

          {/* Stats — Space Mono numerics on torn coverage tickets */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {solution.stats.map((stat, index) => (
              <ScrollReveal key={stat.label} delay={index * 60}>
                <div className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8] text-center">
                  <div className="font-mono text-4xl font-bold leading-none text-[#11100D]">
                    {stat.value}
                  </div>
                  <div className="mt-2 font-display text-xs font-black uppercase tracking-[0.12em] text-[#11100D]/75">
                    {stat.label}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#B56A2B]">
                    and counting
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <p className="mt-8 max-w-3xl text-base leading-relaxed text-[#11100D]/78 sm:text-lg">
              {solution.closer}
            </p>
          </ScrollReveal>
        </section>

        {/* What's Next — the honesty panel (we show our own mistakes) */}
        <ScrollReveal>
          <section className="hazards-panel mt-14" aria-labelledby="whats-next-heading">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#F2C94C]">
              Still being built
            </p>
            <h2
              id="whats-next-heading"
              className="mt-3 font-display text-2xl font-black uppercase leading-tight text-[#F4EBD8] sm:text-3xl"
            >
              I&apos;d rather show you the bug than hide it
            </h2>
            <div className="mt-6 space-y-5">
              {whatsNext.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="max-w-3xl text-sm leading-relaxed text-[#F4EBD8]/85 sm:text-base"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal>
          <section className="relative mt-14 border-2 border-[#11100D] bg-[#F0E5CC] px-6 py-12 text-center shadow-[3px_4px_0_rgba(17,16,13,0.25)]">
            <QuiverSticker
              sticker="creamTape"
              className="absolute -top-5 left-1/2 hidden w-32 -translate-x-1/2 -rotate-3 opacity-90 sm:block"
            />
            <h2 className="font-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
              {cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#11100D]/75 sm:text-lg">
              {cta.subtitle}
            </p>
            <div className="mt-8">
              <AboutCtaButtons
                primaryLabel={cta.primaryLabel}
                primaryHref={cta.primaryHref}
                secondaryLabel={cta.secondaryLabel}
                secondaryHref={cta.secondaryHref}
                tertiaryLabel={cta.tertiaryLabel}
                tertiaryHref={cta.tertiaryHref}
              />
            </div>
          </section>
        </ScrollReveal>
      </main>
    </ZineSurface>
  );
}
