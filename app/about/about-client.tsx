"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ABOUT_CONTENT } from "@/lib/constants/content";
import { SectionFadeUp } from "@/components/shared/section-fade-up";

export default function AboutPageClient() {
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
          <SectionFadeUp delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-white text-[#252D6B] hover:bg-gray-50 px-8 py-4 text-lg font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                asChild
              >
                <Link href={cta.primaryHref}>
                  {cta.primaryLabel}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="border border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-heading font-semibold rounded-full transition-all duration-300"
                asChild
              >
                <a href={cta.secondaryHref}>{cta.secondaryLabel}</a>
              </Button>
            </div>
          </SectionFadeUp>
        </div>
      </section>
    </div>
  );
}
