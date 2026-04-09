import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { ABOUT_CONTENT } from "@/lib/constants/content";
import { SectionFadeUp } from "@/components/shared/section-fade-up";
import { AboutCtaButtons } from "./about-cta-buttons";

// ISR: Revalidate every 1 hour (static content, rarely changes)
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "About Quiver — Why I Built This",
  description:
    "I was tired of checking five apps before every session and showing up to conditions that didn't match. So I built Quiver — real surf data from real sources, for surfers who want to make the call.",
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
    <div className="min-h-screen bg-[#252D6B]">
      {/* Hero */}
      <section className="pt-20 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <SectionFadeUp>
            <h1 className="text-3xl md:text-5xl font-heading font-bold text-white mb-6 leading-tight">
              {hero.title}
            </h1>
          </SectionFadeUp>
          <SectionFadeUp delay={0.2}>
            <p className="text-xl md:text-2xl text-high font-sans leading-relaxed">
              {hero.subtitle}
            </p>
          </SectionFadeUp>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {problem.map((paragraph, index) => (
            <SectionFadeUp key={paragraph.slice(0, 40)} delay={index * 0.15}>
              <p className="text-lg text-high font-sans leading-relaxed">
                {paragraph}
              </p>
            </SectionFadeUp>
          ))}
        </div>
      </section>

      {/* What Quiver Actually Does */}
      <section className="py-16 px-4 bg-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <SectionFadeUp>
            <p className="text-lg text-high font-sans leading-relaxed max-w-3xl mb-12">
              {solution.intro}
            </p>
          </SectionFadeUp>

          {/* Stats Bar */}
          <SectionFadeUp delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {solution.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#2D357D] border border-white/10 rounded-lg p-6 text-center"
                >
                  <div className="text-3xl font-heading font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-medium">{stat.label}</div>
                  <div className="text-xs text-medium mt-0.5">and counting</div>
                </div>
              ))}
            </div>
          </SectionFadeUp>

          <SectionFadeUp delay={0.3}>
            <p className="text-lg text-high font-sans leading-relaxed max-w-3xl">
              {solution.closer}
            </p>
          </SectionFadeUp>
        </div>
      </section>

      {/* What's Next */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {whatsNext.map((paragraph, index) => (
            <SectionFadeUp key={paragraph.slice(0, 40)} delay={index * 0.15}>
              <p className="text-lg text-high font-sans leading-relaxed">
                {paragraph}
              </p>
            </SectionFadeUp>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-20 px-4"
        style={{
          boxShadow: "inset 0 0 120px rgba(247, 142, 66, 0.15)",
        }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <SectionFadeUp>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              {cta.title}
            </h2>
          </SectionFadeUp>
          <SectionFadeUp delay={0.15}>
            <p className="text-lg text-high font-sans mb-8">{cta.subtitle}</p>
          </SectionFadeUp>
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
    </div>
  );
}
