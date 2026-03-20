"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";
import { useAuth } from "@/context/auth-context";
import { CONTENT } from "@/lib/constants/features";

const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];

const FADE_UP_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function CTASection() {
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });
  const shouldReduceMotion = useReducedMotion();

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
          <Button
            size="lg"
            className="bg-ocean-blue text-white rounded-full px-8 py-3 font-sans font-semibold hover:shadow-xl hover:shadow-ocean-blue/20 transition-all duration-200 hover:bg-ocean-blue/90 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
            asChild
          >
            <Link href={preserveQueryParams("/auth/sign-up", searchParams)}>
              {CONTENT.hero.cta}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <Button
            size="lg"
            variant="ghost"
            className="border border-white/30 text-white rounded-full px-6 py-3 font-sans font-semibold hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
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
          Free. No paywall. No catch.
        </motion.p>
      </div>
    </section>
  );
}
