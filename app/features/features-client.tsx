"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FEATURES_EXTENDED_CONTENT } from "@/lib/constants/content";
import { motion } from "framer-motion";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { PersonalizationShowcase } from "@/components/landing-page/personalization-showcase";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { track } from "@/lib/analytics";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FeaturesPageClient() {
  const { hero, benefits, deepDive, cta } = FEATURES_EXTENDED_CONTENT;
  const { user } = useAuth();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authSource, setAuthSource] = useState("features-hero");

  // Scroll depth tracking with rAF guard to avoid excessive work on fast scroll
  const scrollMilestones = useRef(new Set<number>());
  const scrollRafPending = useRef(false);
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRafPending.current) return;
      scrollRafPending.current = true;
      requestAnimationFrame(() => {
        scrollRafPending.current = false;
        const docHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;
        const scrollPercent = Math.round((window.scrollY / docHeight) * 100);
        for (const milestone of [25, 50, 75, 100]) {
          if (
            scrollPercent >= milestone &&
            !scrollMilestones.current.has(milestone)
          ) {
            scrollMilestones.current.add(milestone);
            track("scroll_depth", {
              page: "/features",
              depth_percent: milestone,
            });
          }
        }
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignupClick = useCallback((ctaLocation: string) => {
    track("signup_cta_click", { source: "features", cta_type: ctaLocation });
    trackAuthModalOpened({
      mode: "signup",
      source: `features-${ctaLocation}`,
    });
    setAuthSource(`features-${ctaLocation}`);
    setAuthModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Section 1: Hero — Dark theme */}
      <section className="py-20 px-4 bg-[#252D6B]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="text-center mb-12"
          >
            <motion.h1
              className="text-4xl md:text-6xl font-heading font-bold text-white mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {hero.title}
            </motion.h1>
            <motion.p
              className="text-xl md:text-2xl text-high mb-8 font-sans max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {hero.subtitle}
            </motion.p>

            {!user && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="flex justify-center mb-12"
              >
                <Button
                  size="lg"
                  onClick={() => handleSignupClick("hero")}
                  className="bg-white text-[#252D6B] hover:bg-gray-100 px-8 py-4 text-lg font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Get My Forecast
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            )}
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/10 backdrop-blur-sm rounded-2xl p-8"
          >
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
          </motion.div>
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

      {/* Section 3: Benefits + Social Proof — Dark theme */}
      <section className="py-20 px-4 bg-[#252D6B]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              Everything You Need, Nothing You Don&apos;t
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {benefits.cards.map((card, index) => (
              <motion.div
                key={card.id}
                {...ANIMATION_VARIANTS.staggerItem(index, 0.5)}
              >
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
              </motion.div>
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
          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-dark-grey mb-4">
              {deepDive.heading}
            </h2>
          </motion.div>

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
        <motion.div
          {...ANIMATION_VARIANTS.fadeInView}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {cta.title}
          </motion.h2>
          <motion.p
            className="text-xl text-high mb-8 font-sans"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {cta.subtitle}
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {!user && (
              <Button
                size="lg"
                onClick={() => handleSignupClick("bottom-cta")}
                className="bg-white text-ocean-blue hover:bg-gray-50 px-8 py-4 text-lg font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {cta.primaryCta.text}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}

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
          </motion.div>

          <motion.p
            className="text-high text-sm font-sans"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {cta.note}
          </motion.p>
        </motion.div>
      </section>

      <StickySignupBar
        source="features"
        ctaText="Get My Forecast"
        supportingText="Personalized surf forecasts"
        scrollThreshold={400}
      />

      {authModalOpen && (
        <UnifiedAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode="signup"
          source={authSource}
          returnTo={pathname}
          contextMessage={{
            title: "Your Personalized Forecast Awaits",
            description:
              "Create an account to unlock match scores for every beach.",
          }}
        />
      )}
    </div>
  );
}
