"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";
import { useAuth } from "@/context/auth-context";
import { CONTENT } from "@/lib/constants/features";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];

const FADE_UP_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface CTASectionProps {
  source?: string;
  ctaType?: string;
  ctaCopyVariant?: string;
  returnTo?: string;
  contextMessage?: { title: string; description: string };
  variant?: "signup" | "app-store";
}

export function CTASection({
  source = "final-cta",
  ctaType = "bottom-cta",
  ctaCopyVariant,
  returnTo = "/",
  contextMessage,
  variant = "signup",
}: CTASectionProps) {
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasTrackedView = useRef(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });
  const shouldReduceMotion = useReducedMotion();
  const isAppStoreCta = variant === "app-store";

  useEffect(() => {
    if (user || isLoading || !isInView || hasTrackedView.current) return;
    hasTrackedView.current = true;
    if (isAppStoreCta) {
      trackIosAppCtaView({
        source,
        surface: "landing-page",
        placement: "landing_final_cta",
      });
      return;
    }

    trackSignupCtaView({
      source,
      cta_type: ctaType,
      cta_copy_variant: ctaCopyVariant,
    });
  }, [
    ctaCopyVariant,
    ctaType,
    isAppStoreCta,
    isInView,
    isLoading,
    source,
    user,
  ]);

  // Don't render for authenticated users (show during loading to avoid CLS)
  if (!isLoading && user) return null;

  const animate = isInView || shouldReduceMotion;

  const motionProps = (delayMs: number) => ({
    variants: FADE_UP_VARIANTS,
    initial: shouldReduceMotion ? false : "hidden",
    animate: animate ? "visible" : "hidden",
    transition: {
      duration: 0.6,
      ease: EASE_OUT_QUART,
      delay: shouldReduceMotion ? 0 : delayMs / 1000,
    },
  });

  return (
    <section className="pt-8 pb-24 md:pt-10 md:pb-32 px-4 bg-[#252D6B] noise-texture-strong relative">
      <div
        ref={sectionRef}
        className="max-w-4xl mx-auto text-center relative z-10"
      >
        <motion.h2
          className="text-3xl md:text-4xl font-heading font-bold text-white mb-6 text-glow-orange"
          {...motionProps(0)}
        >
          {CONTENT.sections.cta.title}
        </motion.h2>

        <motion.p
          className="text-xl text-[#9AABC6] mb-8 font-sans"
          {...motionProps(150)}
        >
          {CONTENT.sections.cta.subtitle}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6"
          {...motionProps(300)}
        >
          {isAppStoreCta ? (
            <Button
              size="lg"
              className="bg-ocean-blue text-white rounded-full px-8 py-3 font-sans font-semibold hover:shadow-xl hover:shadow-ocean-blue/20 transition-[background-color,box-shadow,transform] duration-200 hover:bg-ocean-blue/90 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
              asChild
            >
              <a
                href={IOS_APP_STORE_WEB_REDIRECT_PATH}
                onClick={() => {
                  trackIosAppCtaClick({
                    source,
                    surface: "landing-page",
                    placement: "landing_final_cta",
                    cta_text: IOS_APP_STORE_CTA,
                    destination_url: IOS_APP_STORE_WEB_REDIRECT_PATH,
                  });
                }}
              >
                {IOS_APP_STORE_CTA}
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          ) : (
            <Button
              size="lg"
              className="bg-ocean-blue text-white rounded-full px-8 py-3 font-sans font-semibold hover:shadow-xl hover:shadow-ocean-blue/20 transition-[background-color,box-shadow,transform] duration-200 hover:bg-ocean-blue/90 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
              onClick={() => {
                trackSignupCtaClick({
                  source,
                  cta_type: ctaType,
                  cta_text: CONTENT.hero.cta,
                  cta_copy_variant: ctaCopyVariant,
                });
                setAuthModalOpen(true);
              }}
            >
              {CONTENT.hero.cta}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          )}

          <Button
            size="lg"
            variant="ghost"
            className="border border-white/30 text-white rounded-full px-6 py-3 font-sans font-semibold hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0 transition-[color,background-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
            asChild
          >
            <Link href={preserveQueryParams("/about", searchParams)}>
              Learn More
            </Link>
          </Button>
        </motion.div>

        <motion.p
          className="text-white/50 text-sm font-sans"
          {...motionProps(400)}
        >
          {isAppStoreCta
            ? "Opens the current iPhone App Store listing."
            : "iPhone app is live. Android beta is open."}
        </motion.p>
      </div>
      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={source}
        returnTo={preserveQueryParams(returnTo, searchParams)}
        contextMessage={
          contextMessage ?? {
            title: "See Your Forecast",
            description: "Conditions explained clearly in 30 seconds",
          }
        }
      />
    </section>
  );
}
