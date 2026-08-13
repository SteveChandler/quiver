"use client";

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp } from "lucide-react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "./section-wrapper";
import { CONTENT } from "@/lib/constants/features";
import { useAuth } from "@/context/auth-context";
import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";

type FeatureId = "forecast" | "journal" | "intel";

interface Feature {
  id: FeatureId;
  railLabel: string;
  headline: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
}

const FEATURES: Feature[] = [
  {
    id: "forecast",
    railLabel: "Forecast",
    headline: CONTENT.sections.forecast.title,
    body: CONTENT.sections.forecast.subtitle,
    imageSrc: "/images/app-screenshots/surf-call-720.webp",
    imageAlt:
      "Quiver app showing a La Jolla Shores surf call with best-window, swell, wind, tide, and session guidance.",
  },
  {
    id: "journal",
    railLabel: "Log",
    headline: "Log what actually happened",
    body: "After your session, save the beach, board, rating, notes, and wave check so Quiver has real surf signal to learn from.",
    imageSrc: "/images/app-screenshots/session-log-720.webp",
    imageAlt:
      "Quiver Log Session screen with beach search, board picker, duration, rating, and wave conditions.",
  },
  {
    id: "intel",
    railLabel: "Check",
    headline: "Check the beach before you commit",
    body: "Use local reports, photos, and spot context to ground-truth the call before you drive or paddle out.",
    imageSrc: "/images/app-screenshots/local-intel-720.webp",
    imageAlt:
      "Quiver beach finder screen showing nearby surf spots, skill filters, and trending local breaks.",
  },
];

export function ForecastSection() {
  const [activeFeatureId, setActiveFeatureId] = useState<FeatureId>("forecast");
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const { user } = useAuth();
  const hasTrackedView = useRef(false);

  const activeFeature =
    FEATURES.find((f) => f.id === activeFeatureId) || FEATURES[0];

  useEffect(() => {
    if (user || !isInView || hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackIosAppCtaView({
      source: "forecast-section",
      surface: "landing-page",
      placement: "forecast_section",
    });
  }, [user, isInView]);

  const handleIosAppClick = useCallback(() => {
    trackIosAppCtaClick({
      source: "forecast-section",
      surface: "landing-page",
      placement: "forecast_section",
      cta_text: IOS_APP_STORE_CTA,
      destination_url: IOS_APP_STORE_WEB_REDIRECT_PATH,
    });
  }, []);

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    const currentIndex = FEATURES.findIndex((f) => f.id === activeFeatureId);
    const previousIndex =
      currentIndex === 0 ? FEATURES.length - 1 : currentIndex - 1;
    setActiveFeatureId(FEATURES[previousIndex].id);
  }, [activeFeatureId]);

  const handleNext = useCallback(() => {
    const currentIndex = FEATURES.findIndex((f) => f.id === activeFeatureId);
    const nextIndex =
      currentIndex === FEATURES.length - 1 ? 0 : currentIndex + 1;
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
        targetIndex =
          currentIndex === FEATURES.length - 1 ? 0 : currentIndex + 1;
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        targetIndex =
          currentIndex === 0 ? FEATURES.length - 1 : currentIndex - 1;
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
            `[data-feature-id="${FEATURES[targetIndex].id}"]`,
          ) as HTMLElement;
          newTab?.focus();
        }, 0);
      }
    },
    [],
  );

  return (
    <SectionWrapper
      className="relative overflow-hidden pt-8 pb-8 md:pt-10 md:pb-10 px-4 bg-[#252D6B]"
      maxWidth="6xl"
    >
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-ocean-blue/[0.06] rounded-full blur-[100px] pointer-events-none" />

      <div
        ref={sectionRef}
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
                  tabIndex={activeFeatureId === feature.id ? 0 : -1}
                  onClick={() => handleFeatureClick(feature.id)}
                  onKeyDown={(e) => handleKeyDown(e, feature.id)}
                  className={`
                    px-4 py-2 rounded-full text-xs font-semibold transition-[color,background-color,box-shadow]
                    focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]
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
                  className="h-10 w-10 rounded-full bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.15] transition-colors focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
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
                    tabIndex={activeFeatureId === feature.id ? 0 : -1}
                    onClick={() => handleFeatureClick(feature.id)}
                    onKeyDown={(e) => handleKeyDown(e, feature.id)}
                    className={`
                      text-sm text-left underline underline-offset-4 transition-[color,box-shadow]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B] focus-visible:rounded
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
                  className="h-10 w-10 rounded-full bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.15] transition-colors focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
                >
                  <ArrowDown
                    aria-hidden="true"
                    className="mx-auto h-4 w-4 text-white"
                  />
                </button>
              </div>
            </div>

            {/* Center: app screenshot with cross-fade */}
            <div className="flex justify-center shrink-0">
              <div className="relative w-[260px] sm:w-[300px] md:w-[340px] lg:w-[360px]">
                <div
                  role="tabpanel"
                  id="phone-mock-panel"
                  aria-labelledby={`tab-${activeFeatureId}`}
                  className="relative aspect-[9/19.5] overflow-hidden rounded-[32px] shadow-2xl shadow-slate-900/50 ring-1 ring-white/10"
                  data-testid="phone-screen"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeFeatureId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={activeFeature.imageSrc}
                        alt={activeFeature.imageAlt}
                        fill
                        sizes="(min-width: 1024px) 360px, (min-width: 768px) 340px, (min-width: 640px) 300px, 260px"
                        className="object-cover"
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Right: copy + CTAs */}
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
                </motion.div>
              </AnimatePresence>

              <div className="mt-10 flex flex-col gap-4 items-center md:items-start">
                <Button
                  asChild
                  className="rounded-full bg-ocean-blue px-7 py-3 text-sm font-semibold text-white shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-ocean-blue/90 hover:shadow-xl active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
                  data-testid={`forecast-cta-${activeFeatureId}`}
                >
                  <a
                    href={IOS_APP_STORE_WEB_REDIRECT_PATH}
                    onClick={handleIosAppClick}
                  >
                    {IOS_APP_STORE_CTA}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
