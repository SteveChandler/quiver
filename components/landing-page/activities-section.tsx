"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { CONTENT, SURF_ACTIVITIES } from "@/lib/constants/features";

const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];
const STAGGER_DELAY_MS = 80;
const MOBILE_ANIMATED_COUNT = 4;

export function ActivitiesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });
  const shouldReduceMotion = useReducedMotion();

  const animate = isInView || shouldReduceMotion;

  return (
    <SectionWrapper
      className="pt-16 pb-8 md:pt-20 md:pb-10 px-4 bg-[#252D6B]"
      noiseVariant="none"
    >
      <div ref={sectionRef}>
        {/* Section heading — animated separately for scroll-triggered reveal */}
        <motion.div
          className="mb-10 md:mb-12"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          animate={animate ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease: EASE_OUT_QUART }}
        >
          <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-white">
            {CONTENT.sections.activities.title}
          </h2>
        </motion.div>

        {/* Desktop / Tablet: evenly spread across full width */}
        <ul className="hidden w-full items-start justify-between md:flex">
          {SURF_ACTIVITIES.map((activity, index) => (
            <motion.li
              key={activity.title}
              className="flex flex-col items-center text-center"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={
                animate ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
              }
              transition={{
                duration: 0.4,
                ease: EASE_OUT_QUART,
                delay: shouldReduceMotion ? 0 : (index * STAGGER_DELAY_MS) / 1000,
              }}
            >
              <Link
                href={activity.link}
                className="group flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B] rounded-2xl"
              >
                <span className="relative flex h-24 w-24 shrink-0 items-center justify-center md:h-28 md:w-28 lg:h-32 lg:w-32 rounded-full overflow-hidden shadow-lg shadow-black/20 ring-1 ring-white/10 transition-[box-shadow,transform] group-hover:ring-ocean-blue/40 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(74,112,217,0.15)]">
                  <Image
                    src={activity.imageSrc}
                    alt={activity.imageAlt}
                    width={128}
                    height={128}
                    className="h-full w-full object-cover object-center"
                  />
                </span>
                <span className="mt-4 text-sm font-medium font-sans text-white/90 hover:text-ocean-blue group-hover:text-ocean-blue transition-colors">
                  {activity.title}
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>

        {/* Mobile: horizontal scroll with snap points */}
        <ul className="flex w-full snap-x snap-mandatory gap-8 overflow-x-auto pb-4 -mx-4 px-4 md:hidden">
          {SURF_ACTIVITIES.map((activity, index) => {
            // Only animate the first MOBILE_ANIMATED_COUNT items; items scrolled
            // to later enter without entrance animation to avoid stale hidden state.
            const shouldAnimate = index < MOBILE_ANIMATED_COUNT;

            return (
              <motion.li
                key={activity.title}
                className="shrink-0 snap-start flex flex-col items-center text-center"
                initial={
                  shouldReduceMotion || !shouldAnimate
                    ? false
                    : { opacity: 0, scale: 0.8 }
                }
                animate={
                  shouldReduceMotion || !shouldAnimate
                    ? { opacity: 1, scale: 1 }
                    : animate
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.8 }
                }
                transition={{
                  duration: 0.4,
                  ease: EASE_OUT_QUART,
                  delay:
                    shouldReduceMotion || !shouldAnimate
                      ? 0
                      : (index * STAGGER_DELAY_MS) / 1000,
                }}
              >
                <Link
                  href={activity.link}
                  className="group flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B] rounded-2xl"
                >
                  <span className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full overflow-hidden shadow-lg shadow-black/20 ring-1 ring-white/10 transition-shadow group-hover:ring-ocean-blue/40 group-hover:shadow-[0_0_15px_rgba(74,112,217,0.15)]">
                    <Image
                      src={activity.imageSrc}
                      alt={activity.imageAlt}
                      width={96}
                      height={96}
                      className="h-full w-full object-cover object-center"
                    />
                  </span>
                  <span className="mt-4 text-sm font-medium font-sans text-white/90 hover:text-ocean-blue group-hover:text-ocean-blue transition-colors">
                    {activity.title}
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </SectionWrapper>
  );
}
