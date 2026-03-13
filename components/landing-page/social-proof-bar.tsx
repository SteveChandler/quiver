"use client";

import { useCallback, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface CommunityStats {
  totalBeaches: number;
  totalSessions: number;
  totalUsers: number;
  reportsToday: number;
}

/**
 * Build a single human-readable social proof statement from community stats.
 * Picks the most compelling data point available, or falls back to beach coverage.
 */
function buildProofStatement(stats: CommunityStats): string {
  // If we have reports today, show recency
  if (stats.reportsToday > 0) {
    const plural = stats.reportsToday === 1 ? "report" : "reports";
    return `${stats.reportsToday} conditions ${plural} filed today`;
  }

  // If we have meaningful session data, show activity
  if (stats.totalSessions > 100) {
    const formatted =
      stats.totalSessions >= 1000
        ? `${(stats.totalSessions / 1000).toFixed(stats.totalSessions >= 10000 ? 0 : 1)}k`
        : String(stats.totalSessions);
    return `${formatted} sessions logged by the Quiver crew`;
  }

  // If we have users, mention the community
  if (stats.totalUsers > 10) {
    return `${stats.totalUsers} surfers tracking conditions on Quiver`;
  }

  // Fallback: beach coverage (always available)
  return `${stats.totalBeaches}+ beaches across California, Oregon, Washington, Hawaii & beyond`;
}

/**
 * SocialProofBar -- Shows a single dynamic social proof statement on the landing page.
 *
 * Fetches real data from the public stats API and formats the most compelling
 * data point as a human-readable sentence. Falls back to beach coverage count.
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

  const statement = buildProofStatement(
    stats ?? { totalBeaches: 750, totalSessions: 0, totalUsers: 0, reportsToday: 0 }
  );

  return (
    <div ref={sectionRef}>
      <motion.p
        className="text-center text-sm sm:text-base text-[#9AABC6] font-sans py-3 px-4"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
      >
        {statement}
      </motion.p>
    </div>
  );
}
