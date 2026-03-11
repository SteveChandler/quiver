"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "./section-wrapper";
import { CONTENT } from "@/lib/constants/features";
import {
  BestSpotMock,
  SessionJournalMock,
  LocalIntelMock,
} from "./phone-mocks";

// Feature type definition
type FeatureId = "forecast" | "journal" | "intel";

interface Feature {
  id: FeatureId;
  railLabel: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  PhoneMockComponent: React.ComponentType;
}

// Features configuration
const FEATURES: Feature[] = [
  {
    id: "forecast",
    railLabel: "Personalized Forecast",
    headline: CONTENT.sections.forecast.title,
    body: CONTENT.sections.forecast.subtitle,
    ctaLabel: CONTENT.sections.forecast.primaryCta,
    ctaHref: "/map",
    PhoneMockComponent: BestSpotMock,
  },
  {
    id: "journal",
    railLabel: "Session Journal",
    headline: "Track your surf story",
    body: "Log sessions. Unlock better forecasts.",
    ctaLabel: "Start your journal",
    ctaHref: "/sessions/new",
    PhoneMockComponent: SessionJournalMock,
  },
  {
    id: "intel",
    railLabel: "Local Intel",
    headline: "Real conditions from real surfers",
    body: "Real-time posts, photos, and crowd reports from surfers at your local breaks.",
    ctaLabel: "Explore the map",
    ctaHref: "/map",
    PhoneMockComponent: LocalIntelMock,
  },
];

export function ForecastSection() {
  const [activeFeatureId, setActiveFeatureId] = useState<FeatureId>("forecast");
  
  const activeFeature = FEATURES.find((f) => f.id === activeFeatureId) || FEATURES[0];
  const ActivePhoneMock = activeFeature.PhoneMockComponent;

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    const currentIndex = FEATURES.findIndex((f) => f.id === activeFeatureId);
    const previousIndex = currentIndex === 0 ? FEATURES.length - 1 : currentIndex - 1;
    setActiveFeatureId(FEATURES[previousIndex].id);
  }, [activeFeatureId]);

  const handleNext = useCallback(() => {
    const currentIndex = FEATURES.findIndex((f) => f.id === activeFeatureId);
    const nextIndex = currentIndex === FEATURES.length - 1 ? 0 : currentIndex + 1;
    setActiveFeatureId(FEATURES[nextIndex].id);
  }, [activeFeatureId]);

  const handleFeatureClick = useCallback((featureId: FeatureId) => {
    setActiveFeatureId(featureId);
  }, []);

  // Keyboard navigation for tablist
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, featureId: FeatureId) => {
      const currentIndex = FEATURES.findIndex((f) => f.id === featureId);
      let targetIndex = currentIndex;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        targetIndex = currentIndex === FEATURES.length - 1 ? 0 : currentIndex + 1;
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        targetIndex = currentIndex === 0 ? FEATURES.length - 1 : currentIndex - 1;
      } else if (e.key === "Home") {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        targetIndex = FEATURES.length - 1;
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActiveFeatureId(featureId);
        return;
      }

      if (targetIndex !== currentIndex) {
        setActiveFeatureId(FEATURES[targetIndex].id);
        // Focus the new tab
        setTimeout(() => {
          const newTab = document.querySelector(
            `[data-feature-id="${FEATURES[targetIndex].id}"]`
          ) as HTMLElement;
          newTab?.focus();
        }, 0);
      }
    },
    []
  );

  return (
    <SectionWrapper className="relative py-16 md:py-20 px-4 bg-[#252D6B] noise-texture" maxWidth="6xl">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-ocean-blue/[0.06] rounded-full blur-[100px] pointer-events-none" />

      <div
        className="relative overflow-hidden rounded-3xl bg-white/[0.04] backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] animate-fade-in-up"
        data-testid="forecast-section"
      >
        <div className="px-4 sm:px-8 md:px-12 lg:px-20 py-12 md:py-16 lg:py-20">
          {/* Mobile: Horizontal segmented control */}
          <div className="md:hidden mb-8">
            <div
              role="tablist"
              aria-label="Feature switcher"
              className="flex items-center justify-center gap-2 flex-wrap"
            >
              {FEATURES.map((feature) => (
                <button
                  key={feature.id}
                  role="tab"
                  aria-selected={activeFeatureId === feature.id}
                  aria-controls="phone-mock-panel"
                  data-feature-id={feature.id}
                  onClick={() => handleFeatureClick(feature.id)}
                  onKeyDown={(e) => handleKeyDown(e, feature.id)}
                  className={`
                    px-4 py-2 rounded-full text-xs font-semibold transition-all
                    focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2
                    ${
                      activeFeatureId === feature.id
                        ? "bg-ocean-blue text-white shadow-sm"
                        : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                    }
                  `}
                >
                  {feature.railLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[180px_auto_1fr] gap-y-8 gap-x-12 lg:gap-x-24 items-center">
            {/* Desktop: Left rail navigation */}
            <div className="hidden md:flex w-[180px] shrink-0 flex-col items-center md:items-start md:self-stretch md:justify-center">
              <div className="flex items-center justify-center md:justify-start">
                <button
                  type="button"
                  aria-label="Previous feature"
                  onClick={handlePrevious}
                  className="h-10 w-10 rounded-full bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.15] transition-colors focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2"
                >
                  <ArrowUp
                    aria-hidden="true"
                    className="mx-auto h-4 w-4 text-white"
                  />
                </button>
              </div>

              <div
                role="tablist"
                aria-label="Feature switcher"
                aria-orientation="vertical"
                className="mt-8 flex flex-col items-center md:items-start gap-6"
              >
                {FEATURES.map((feature) => (
                  <button
                    key={feature.id}
                    role="tab"
                    aria-selected={activeFeatureId === feature.id}
                    aria-controls="phone-mock-panel"
                    data-feature-id={feature.id}
                    onClick={() => handleFeatureClick(feature.id)}
                    onKeyDown={(e) => handleKeyDown(e, feature.id)}
                    className={`
                      text-sm text-left underline underline-offset-4 transition-all
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:rounded
                      ${
                        activeFeatureId === feature.id
                          ? "font-bold text-white decoration-white/40 decoration-2"
                          : "font-normal text-white/50 decoration-white/20 hover:decoration-white/40"
                      }
                    `}
                  >
                    {feature.railLabel}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center md:justify-start">
                <button
                  type="button"
                  aria-label="Next feature"
                  onClick={handleNext}
                  className="h-10 w-10 rounded-full bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.15] transition-colors focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2"
                >
                  <ArrowDown
                    aria-hidden="true"
                    className="mx-auto h-4 w-4 text-white"
                  />
                </button>
              </div>
            </div>

            {/* Center: phone mock with animation */}
            <div className="flex justify-center shrink-0">
              <div className="relative w-[260px] sm:w-[300px] md:w-[340px] lg:w-[360px]">
                {/* Device frame - iPhone-style with visible bezel */}
                <div className="relative aspect-[9/19.5] rounded-[48px] bg-slate-900 p-3 shadow-2xl shadow-slate-900/30 ring-[3px] ring-slate-800">
                  {/* Bezel highlight - subtle metallic effect */}
                  <div className="pointer-events-none absolute inset-0 rounded-[48px] bg-gradient-to-br from-slate-700/30 via-transparent to-slate-950/50" />

                  {/* Side buttons */}
                  <div className="pointer-events-none absolute -left-[4px] top-[20%] h-8 w-[4px] rounded-l-sm bg-slate-700" />
                  <div className="pointer-events-none absolute -left-[4px] top-[28%] h-14 w-[4px] rounded-l-sm bg-slate-700" />
                  <div className="pointer-events-none absolute -left-[4px] top-[38%] h-14 w-[4px] rounded-l-sm bg-slate-700" />
                  <div className="pointer-events-none absolute -right-[4px] top-[30%] h-20 w-[4px] rounded-r-sm bg-slate-700" />

                  {/* Dynamic Island */}
                  <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 z-10">
                    <div className="h-7 w-28 rounded-full bg-black shadow-inner flex items-center justify-end pr-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-800 ring-1 ring-slate-700" />
                    </div>
                  </div>

                  {/* Screen with animated phone mock */}
                  <div
                    role="tabpanel"
                    id="phone-mock-panel"
                    aria-labelledby={`tab-${activeFeatureId}`}
                    className="relative h-full w-full overflow-hidden rounded-[36px] bg-[#f8f9fa]"
                    data-testid="phone-screen"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeFeatureId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="h-full w-full"
                      >
                        <ActivePhoneMock />
                      </motion.div>
                    </AnimatePresence>

                    {/* Home indicator */}
                    <div className="pointer-events-none absolute bottom-2 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full bg-slate-900" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: copy + CTAs with animation */}
            <div className="text-center md:text-left">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeatureId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <h2 className="text-4xl lg:text-5xl font-heading font-semibold tracking-tight leading-[1.05] text-white">
                    {activeFeature.headline}
                  </h2>
                  <p className="mt-5 text-base leading-7 text-[#9AABC6] max-w-[420px] mx-auto md:mx-0">
                    {activeFeature.body}
                  </p>

                  <div className="mt-10 flex flex-col gap-4 items-center md:items-start">
                    <Button
                      className="rounded-full px-7 py-3 text-sm font-semibold bg-ocean-blue hover:bg-ocean-blue/90 text-white shadow-sm"
                      asChild
                      data-testid={`forecast-cta-${activeFeatureId}`}
                    >
                      <Link href={activeFeature.ctaHref}>
                        {activeFeature.ctaLabel}
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
