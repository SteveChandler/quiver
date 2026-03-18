import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/meta";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FEATURES_EXTENDED_CONTENT } from "@/lib/constants/content";
import { SectionFadeUp } from "@/components/shared/section-fade-up";
import { PersonalizationShowcase } from "@/components/landing-page/personalization-showcase";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FeaturesScrollTracker,
  FeaturesSignupButton,
  FeaturesStickyBar,
} from "./features-interactive";

export const metadata: Metadata = buildPageMetadata({
  title: "AI Surf Forecasts & Personalized Recommendations",
  description:
    "Quiver uses machine learning to correct NOAA wave models with real-time buoy data, delivering personalized surf forecasts with 0-100 match scores. Free for iOS, Android, and web.",
  path: "/features",
  keywords: [
    "ai surf forecast",
    "personalized surf recommendations",
    "ml wave prediction",
    "real-time buoy data",
    "surf forecast accuracy",
    "surf session tracking",
    "ios surf app",
    "android surf app",
  ],
});

export default function FeaturesPage() {
  const { hero, benefits, deepDive, cta } = FEATURES_EXTENDED_CONTENT;

  return (
    <FeaturesScrollTracker>
      <div className="min-h-screen">
        {/* Section 1: Hero -- Dark theme */}
        <section className="py-20 px-4 bg-[#252D6B]">
          <div className="max-w-6xl mx-auto">
            <SectionFadeUp>
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-6xl font-heading font-bold text-white mb-6">
                  {hero.title}
                </h1>
                <p className="text-xl md:text-2xl text-high mb-8 font-sans max-w-3xl mx-auto">
                  {hero.subtitle}
                </p>

                <div className="flex justify-center mb-12">
                  <FeaturesSignupButton
                    ctaLocation="hero"
                    className="bg-[#F78E42] text-white hover:bg-[#e07d35] px-8 py-4 text-lg font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                  />
                </div>
              </div>
            </SectionFadeUp>

            {/* Stats Bar */}
            <SectionFadeUp delay={0.3}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                {hero.stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl md:text-3xl font-heading font-bold text-white">
                      {stat.value}
                    </div>
                    <div className="text-sm text-medium font-sans mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </SectionFadeUp>
          </div>
        </section>

        {/* Section 2: PersonalizationShowcase (reused) with bridge text */}
        <section>
          <div className="max-w-6xl mx-auto px-4 pt-8">
            <p className="text-center text-base font-sans text-gray-500">
              We crunch 40+ data points from buoys, weather models, and community
              reports — so you get one clear answer.
            </p>
          </div>
          <PersonalizationShowcase />
        </section>

        {/* Section 3: Benefits + Social Proof -- Dark theme */}
        <section className="py-20 px-4 bg-[#252D6B]">
          <div className="max-w-6xl mx-auto">
            <SectionFadeUp>
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
                  Everything You Need, Nothing You Don&apos;t
                </h2>
              </div>
            </SectionFadeUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {benefits.cards.map((card, index) => (
                <SectionFadeUp key={card.id} delay={index * 0.1}>
                  <Card className="h-full bg-[#2D357D] border-white/10 shadow-lg">
                    <CardContent className="p-6">
                      <h3 className="text-xl font-heading font-bold text-white mb-2">
                        {card.title}
                      </h3>
                      <p className="text-medium font-sans">
                        {card.description}
                      </p>
                    </CardContent>
                  </Card>
                </SectionFadeUp>
              ))}
            </div>

            <div className="max-w-4xl mx-auto">
              <InlineSignupCta
                title="Sounds good?"
                description="Join surfers who check Quiver before every session."
                primaryButtonText="Get My Forecast"
                source="features-mid-page"
              />
            </div>
          </div>
        </section>

        {/* Section 4: Collapsible Deep-Dive (Accordions) */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <SectionFadeUp>
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-heading font-bold text-dark-grey mb-4">
                  {deepDive.heading}
                </h2>
              </div>
            </SectionFadeUp>

            <Accordion type="multiple" className="w-full">
              {deepDive.items.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-gray-200"
                >
                  <AccordionTrigger className="text-lg font-heading font-semibold text-dark-grey hover:no-underline">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 font-sans leading-relaxed">
                    {item.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Section 5: Final CTA */}
        <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-[#D57835] relative overflow-hidden">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <SectionFadeUp>
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-6">
                {cta.title}
              </h2>
            </SectionFadeUp>
            <SectionFadeUp delay={0.15}>
              <p className="text-xl text-high mb-8 font-sans">
                {cta.subtitle}
              </p>
            </SectionFadeUp>

            <SectionFadeUp delay={0.3}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
                <FeaturesSignupButton
                  ctaLocation="bottom-cta"
                  className="bg-[#F78E42] text-white hover:bg-[#e07d35] px-8 py-4 text-lg font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <>
                    {cta.primaryCta.text}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                </FeaturesSignupButton>

                <Button
                  size="lg"
                  variant="ghost"
                  className="border border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-heading font-semibold rounded-full transition-all duration-300"
                  asChild
                >
                  <Link href={cta.secondaryCta.href}>
                    {cta.secondaryCta.text}
                  </Link>
                </Button>
              </div>
            </SectionFadeUp>

            <SectionFadeUp delay={0.4}>
              <p className="text-high text-sm font-sans">
                {cta.note}
              </p>
            </SectionFadeUp>
          </div>
        </section>

        <FeaturesStickyBar />
      </div>
    </FeaturesScrollTracker>
  );
}
