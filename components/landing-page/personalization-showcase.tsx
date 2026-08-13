"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useInView } from "framer-motion";
import {
  Star,
  Users,
  Waves,
  Wind,
  TrendingUp,
  Clock,
  Droplets,
} from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

// -------------------------------------------------------------------
// Static data for the generic → Quiver transformation
// -------------------------------------------------------------------

interface ForecastRow {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  generic: string;
  quiver: string;
}

const FORECAST_ROWS: ForecastRow[] = [
  {
    icon: Waves,
    label: "Wave Height",
    generic: "3-5 ft",
    quiver: '3.2 ft \u2014 chest-high sets',
  },
  {
    icon: Droplets,
    label: "Conditions",
    generic: "Fair",
    quiver: "Clean faces, light texture",
  },
  {
    icon: Wind,
    label: "Wind",
    generic: "Onshore",
    quiver: "Offshore 5 mph \u2192 onshore by 11am",
  },
  {
    icon: TrendingUp,
    label: "Tide",
    generic: "Rising",
    quiver: "Rising through mid-morning window",
  },
];

// Row stagger: each row animates 0.15s after the previous one.
// The label crossfade starts at 0s, rows at 0.15s intervals, best-window
// fades in after the last row, and score morphs last.
const BASE_DELAY = 0; // label crossfade
const ROW_STAGGER = 0.15;
const ROW_DURATION = 0.4;

function rowDelay(index: number) {
  return BASE_DELAY + ROW_STAGGER * (index + 1);
}

const BEST_WINDOW_DELAY =
  BASE_DELAY + ROW_STAGGER * (FORECAST_ROWS.length + 1);
const SCORE_DELAY = BEST_WINDOW_DELAY + ROW_STAGGER;

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function PersonalizationShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });
  const [isRevealed, setIsRevealed] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();
  const hasTrackedView = useRef(false);

  // Trigger reveal ~1s after the card enters the viewport (once).
  useEffect(() => {
    if (!isInView || isRevealed) return;
    const timer = setTimeout(() => setIsRevealed(true), 1000);
    return () => clearTimeout(timer);
  }, [isInView, isRevealed]);

  // Track CTA view when the section enters viewport for unauthenticated users.
  useEffect(() => {
    if (user || !isInView || hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackSignupCtaView({
      source: "personalization-showcase",
      surface: "landing-page",
    });
  }, [user, isInView]);

  const handleCtaClick = () => {
    trackSignupCtaClick({
      source: "personalization-showcase",
      surface: "landing-page",
    });
    setShowAuth(true);
  };

  return (
    <SectionWrapper
      className="py-16 md:py-20 px-4 bg-white"
      data-testid="personalization-showcase"
    >
      {/* Section header */}
      <div className="text-center mb-10 md:mb-12 animate-fade-in-up">
        <p className="text-base font-sans text-gray-500 mb-3">
          Tired of driving to the beach for blown-out, flat conditions?
        </p>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-dark-grey mb-4">
          Same ocean. Better forecast.
        </h2>
        <p className="text-lg font-sans text-gray-600 max-w-2xl mx-auto">
          Our ML model analyzes 40+ data points to deliver forecasts that match
          what you actually find at the beach.
        </p>
      </div>

      {/* Single animated card */}
      <div ref={ref} className="flex justify-center">
        <div
          className={`
            w-full max-w-[480px] rounded-2xl p-6 sm:p-8
            transition-[background-color,background-image,border-color,box-shadow] duration-700 ease-out
            ${
              isRevealed
                ? "border border-ocean-blue/20 bg-gradient-to-br from-ocean-blue/5 via-white to-ocean-blue/10 ring-1 ring-ocean-blue/10 shadow-md"
                : "border border-gray-200 bg-gray-50 shadow-sm"
            }
          `}
        >
          {/* Card label */}
          <div className="relative h-5 mb-6 overflow-hidden">
            <motion.p
              className="absolute inset-0 text-xs font-semibold uppercase tracking-wider text-gray-400"
              animate={{ opacity: isRevealed ? 0 : 1, y: isRevealed ? -8 : 0 }}
              transition={{ duration: 0.35, delay: BASE_DELAY }}
            >
              Typical Forecast
            </motion.p>
            <motion.p
              className="absolute inset-0 text-xs font-semibold uppercase tracking-wider text-ocean-blue"
              animate={{ opacity: isRevealed ? 1 : 0, y: isRevealed ? 0 : 8 }}
              transition={{ duration: 0.35, delay: BASE_DELAY }}
            >
              Quiver Forecast
            </motion.p>
          </div>

          {/* Forecast rows */}
          <ul className="space-y-4">
            {FORECAST_ROWS.map((row, i) => {
              const Icon = row.icon;
              const delay = rowDelay(i);

              return (
                <li key={row.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    {row.label}
                  </p>
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        color: isRevealed ? "#F78E42" : "#9CA3AF",
                      }}
                      transition={{ duration: ROW_DURATION, delay }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                    </motion.div>

                    <div className="relative h-5 flex-1 overflow-hidden">
                      {/* Generic value */}
                      <motion.span
                        className="absolute inset-0 text-sm font-sans text-gray-400 whitespace-nowrap"
                        animate={{
                          opacity: isRevealed ? 0 : 1,
                          y: isRevealed ? -6 : 0,
                        }}
                        transition={{ duration: ROW_DURATION, delay }}
                      >
                        {row.generic}
                      </motion.span>
                      {/* Quiver value */}
                      <motion.span
                        className="absolute inset-0 text-sm font-sans text-gray-700 whitespace-nowrap"
                        animate={{
                          opacity: isRevealed ? 1 : 0,
                          y: isRevealed ? 0 : 6,
                        }}
                        transition={{ duration: ROW_DURATION, delay }}
                      >
                        {row.quiver}
                      </motion.span>
                    </div>
                  </div>
                </li>
              );
            })}

            {/* Best Window — fades in from below (new row) */}
            <motion.li
              animate={{
                opacity: isRevealed ? 1 : 0,
                height: isRevealed ? "auto" : 0,
                marginTop: isRevealed ? 16 : 0,
              }}
              transition={{ duration: ROW_DURATION, delay: BEST_WINDOW_DELAY }}
              className="overflow-hidden"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Best Window
              </p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-ocean-blue" />
                <span className="text-sm font-sans font-medium text-gray-700">
                  6:30 &ndash; 10:00 AM
                </span>
              </div>
            </motion.li>
          </ul>

          {/* Divider */}
          <motion.div
            className="my-5 h-px"
            animate={{
              backgroundColor: isRevealed
                ? "rgba(0, 119, 182, 0.15)"
                : "rgba(229, 231, 235, 1)",
            }}
            transition={{ duration: 0.5, delay: SCORE_DELAY }}
          />

          {/* Score row */}
          <div className="relative h-10 overflow-hidden">
            {/* Generic score */}
            <motion.div
              className="absolute inset-0 flex items-center"
              animate={{
                opacity: isRevealed ? 0 : 1,
                y: isRevealed ? -10 : 0,
              }}
              transition={{ duration: ROW_DURATION, delay: SCORE_DELAY }}
            >
              <span className="text-2xl font-heading font-bold text-gray-400">
                6/10
              </span>
            </motion.div>

            {/* Quiver score */}
            <motion.div
              className="absolute inset-0 flex items-center gap-3"
              animate={{
                opacity: isRevealed ? 1 : 0,
                y: isRevealed ? 0 : 10,
              }}
              transition={{ duration: ROW_DURATION, delay: SCORE_DELAY }}
            >
              <span className="text-2xl font-heading font-bold text-ocean-blue">
                91% Match
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-ocean-blue/10 px-2.5 py-0.5 text-xs font-semibold text-ocean-blue">
                <Star className="h-3 w-3 fill-current" />
                Top pick
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Powered by ML note */}
      <p className="mt-6 text-center text-sm text-gray-400 font-sans">
        Powered by machine learning &mdash; not just buoy readings.
      </p>

      {/* Conversion CTA — shown only to non-authenticated users */}
      {!user && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            onClick={handleCtaClick}
            className="rounded-full bg-ocean-blue px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ocean-blue/90 active:scale-95 transition-[background-color,transform] duration-150 focus-ring"
          >
            See Your Forecast
          </button>
          <p className="text-xs text-gray-400 font-sans">
            See conditions explained clearly for your level
          </p>
        </div>
      )}

      {/* Community intel callout */}
      <div className="mt-8 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <Users className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium font-sans text-green-700">
            Plus, real-time intel from surfers in the water right now
          </span>
        </div>
      </div>

      {showAuth && (
        <UnifiedAuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          mode="signup"
          source="personalization-showcase"
          returnTo={pathname}
          contextMessage={{
            title: "See Your Forecast",
            description:
              "Sign up to see conditions at every beach, explained clearly for your level",
          }}
        />
      )}
    </SectionWrapper>
  );
}
