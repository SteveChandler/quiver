"use client";

import { useCallback, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Users, MapPin, BarChart3, Waves } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface CommunityStats {
  totalBeaches: number;
  totalSessions: number;
  totalUsers: number;
  reportsToday: number;
}

/**
 * Animated counter that counts up from 0 to the target value.
 * Respects reduced motion preference.
 */
function StatCounter({
  value,
  suffix = "",
  label,
  icon: Icon,
}: {
  value: number;
  suffix?: string;
  label: string;
  icon: React.ElementType;
}) {
  const shouldReduceMotion = useReducedMotion();

  // Format large numbers with commas
  const formatted = value >= 1000
    ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
    : String(value);

  return (
    <div className="flex flex-col items-center gap-1 px-4 py-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-[#F78E42]" />
        <motion.span
          className="text-lg sm:text-xl font-heading font-bold text-white tabular-nums"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {formatted}{suffix}
        </motion.span>
      </div>
      <span className="text-[11px] sm:text-xs text-[#9AABC6] font-sans whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

/**
 * SocialProofBar — Shows live community stats on the landing page.
 *
 * Fetches real data (beach count, session count, user count, today's reports)
 * from the public stats API and displays them in a compact bar.
 * Falls back to static beach count if the API fails.
 */
export function SocialProofBar() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.5 });
  const shouldReduceMotion = useReducedMotion();

  const fetchStats = useCallback(async (): Promise<CommunityStats> => {
    try {
      const response = await fetch("/api/community-stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      return data;
    } catch {
      // Fallback to reasonable static values
      return {
        totalBeaches: 750,
        totalSessions: 0,
        totalUsers: 0,
        reportsToday: 0,
      };
    }
  }, []);

  const { data: stats } = useDataFetcher(fetchStats);

  // Only show stats that have meaningful values
  const showSessions = (stats?.totalSessions ?? 0) > 10;
  const showUsers = (stats?.totalUsers ?? 0) > 5;
  const showReports = (stats?.reportsToday ?? 0) > 0;

  return (
    <div ref={sectionRef}>
      <motion.div
        className="flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-4 gap-y-1 py-3"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <StatCounter
          value={stats?.totalBeaches ?? 750}
          suffix="+"
          label="Beaches covered"
          icon={MapPin}
        />

        {showSessions && (
          <>
            <div className="w-px h-6 bg-white/[0.1] hidden sm:block" />
            <StatCounter
              value={stats?.totalSessions ?? 0}
              label="Sessions logged"
              icon={Waves}
            />
          </>
        )}

        {showUsers && (
          <>
            <div className="w-px h-6 bg-white/[0.1] hidden sm:block" />
            <StatCounter
              value={stats?.totalUsers ?? 0}
              label="Surfers joined"
              icon={Users}
            />
          </>
        )}

        {showReports && (
          <>
            <div className="w-px h-6 bg-white/[0.1] hidden sm:block" />
            <StatCounter
              value={stats?.reportsToday ?? 0}
              label="Reports today"
              icon={BarChart3}
            />
          </>
        )}
      </motion.div>
    </div>
  );
}
