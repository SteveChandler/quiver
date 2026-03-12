"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOracleData } from "@/hooks/use-oracle-data";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getLocalActivity, updatePreferredSessionTime } from "@/actions/oracle-actions";
import { OracleHero } from "@/components/oracle/oracle-hero";
import { ContextualCTA } from "@/components/oracle/contextual-cta";
import { TodaysWindows } from "@/components/oracle/todays-windows";
import { NearbySpots } from "@/components/oracle/nearby-spots";
import { ActivityFeed } from "@/components/oracle/activity-feed";
import { SessionTimeSelector } from "@/components/oracle/session-time-selector";
import { BottomNav } from "@/components/home-screen/bottom-nav";
import type { ActivityItem } from "@/components/oracle/activity-feed";
import type { TimeWindow } from "@/components/oracle/todays-windows";
import type { NearbySpot } from "@/components/oracle/nearby-spots";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import type { LocalActivityItem } from "@/actions/oracle-actions";

/** Extended profile fields not yet in generated Supabase types. */
interface ProfileWithOracle {
  preferred_session_time: string | null;
  level_title: string | null;
  xp_total: number | null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely parse a numeric value from a string that may contain units.
 * e.g. "14s" → 14, "3.2ft" → 3.2, "8 mph" → 8
 */
function parseNumeric(value: string | null | undefined, fallback = 0): number {
  if (!value) return fallback;
  const match = value.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : fallback;
}

/**
 * Format a Date to short time string like "5:45a" or "11:30a".
 */
function formatWindowTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? "a" : "p";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `${displayHour}${displayMinutes}${period}`;
}

/**
 * Compute relative time string from an ISO date string.
 */
function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Generate a personalized best window title based on preferred session time.
 */
function getBestWindowTitle(
  preferredTime: string | null,
  window: SurfDiscoveryRecommendation["window"] | undefined
): string {
  if (!window) return "Surf's looking good";

  const hour = window.start.getHours();

  if (preferredTime === "dawn_patrol" || (!preferredTime && hour < 8)) {
    return "Dawn patrol is your move";
  }
  if (preferredTime === "morning" || (!preferredTime && hour < 12)) {
    return "Morning glass is calling";
  }
  if (preferredTime === "lunch") {
    return "Lunchtime waves are on";
  }
  if (preferredTime === "afternoon" || (!preferredTime && hour < 17)) {
    return "Afternoon session lined up";
  }
  if (preferredTime === "evening") {
    return "Evening session incoming";
  }

  return "Best window found";
}

/**
 * Map the TIME_SLOTS that TodaysWindows expects to hour numbers.
 */
const TIME_SLOT_HOURS: Array<{ time: string; hour: number; label: string }> = [
  { time: "5am", hour: 5, label: "Dawn patrol" },
  { time: "8am", hour: 8, label: "Morning" },
  { time: "11am", hour: 11, label: "Midday" },
  { time: "2pm", hour: 14, label: "Afternoon" },
  { time: "5pm", hour: 17, label: "Evening" },
];

/**
 * Build the 5-slot TimeWindow[] array for TodaysWindows.
 *
 * We use the top recommendation's data as the anchor for the "best" slot.
 * Other slots get synthetic lower-quality bars derived from the best score.
 */
function transformToTimeWindows(
  recommendations: SurfDiscoveryRecommendation[],
  topRec: SurfDiscoveryRecommendation | null
): TimeWindow[] {
  if (!topRec) {
    // Return empty placeholder bars
    return TIME_SLOT_HOURS.map(({ time, label }) => ({
      time,
      label,
      height: "—",
      quality: 0.2,
      isBest: false,
    }));
  }

  const bestHour = topRec.window.start.getHours();
  const bestScore = topRec.score / 100; // normalise 0-100 → 0-1
  const waveHeight = topRec.waveHeightBadge ?? topRec.forecast.wave_height ?? "—";

  return TIME_SLOT_HOURS.map(({ time, hour, label }) => {
    // Check if this slot covers the top rec's window start
    const isBest =
      bestHour >= hour && bestHour < hour + 3;

    let quality: number;
    let slotLabel: string;
    let height: string;

    if (isBest) {
      quality = bestScore;
      slotLabel = topRec.summary.length > 0 ? topRec.summary : label;
      height = waveHeight;
    } else {
      // Check if another recommendation lands in this slot
      const matchedRec = recommendations.find((r) => {
        const h = r.window.start.getHours();
        return h >= hour && h < hour + 3;
      });

      if (matchedRec) {
        quality = matchedRec.score / 100;
        height = matchedRec.waveHeightBadge ?? matchedRec.forecast.wave_height ?? "—";
        slotLabel = label;
      } else {
        // Synthetic fallback: quality degrades away from the best slot
        const hourDiff = Math.abs(hour - bestHour);
        quality = Math.max(0.1, bestScore - hourDiff * 0.15);
        slotLabel = label;
        height = "—";
      }
    }

    return { time, label: slotLabel, height, quality, isBest };
  });
}

/**
 * Map remaining spots to the NearbySpot shape.
 */
function transformToNearbySpots(
  remainingSpots: SurfDiscoveryRecommendation[]
): NearbySpot[] {
  return remainingSpots.map((rec) => ({
    id: rec.beach.id,
    name: rec.beach.name,
    conditions: rec.summary,
    height: rec.waveHeightBadge ?? rec.forecast.wave_height ?? "—",
    photoUrl: rec.beach.photo_url ?? null,
    score: rec.score,
  }));
}

/**
 * Transform raw LocalActivityItem[] (from server action) to ActivityItem[].
 */
function transformActivityItems(raw: LocalActivityItem[]): ActivityItem[] {
  return raw.map((item) => ({
    id: item.id,
    userName: item.userName,
    action: item.action,
    timeAgo: formatTimeAgo(item.createdAt),
    initial: (item.userName[0] ?? "?").toUpperCase(),
    type: item.type,
  }));
}

// ============================================================================
// Loading skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#252D6B] animate-pulse">
      {/* Hero placeholder */}
      <div className="h-[520px] w-full bg-[#2D357D] rounded-2xl" />
      {/* Content placeholders */}
      <div className="space-y-6 px-6 py-4">
        <div className="h-10 rounded-xl bg-[#2D357D]" />
        <div className="h-32 rounded-xl bg-[#2D357D]" />
        <div className="h-24 rounded-xl bg-[#2D357D]" />
      </div>
    </div>
  );
}

// ============================================================================
// OracleHomeScreen
// ============================================================================

export function OracleHomeScreen() {
  const oracle = useOracleData();
  const router = useRouter();
  const { refreshProfile } = oracle;

  // ------------------------------------------------------------------
  // Activity fetch — use homeBeach, falling back to topRec's beach
  // ------------------------------------------------------------------
  const activityBeachId = oracle.homeBeach?.id ?? oracle.topRecommendation?.beach?.id ?? null;

  const fetchActivity = useCallback(async (): Promise<LocalActivityItem[]> => {
    if (!activityBeachId) return [];
    const result = await getLocalActivity(activityBeachId);
    return result?.data ?? [];
  }, [activityBeachId]);

  const { data: activityRaw } = useDataFetcher(fetchActivity, {
    skip: !activityBeachId,
  });

  // ------------------------------------------------------------------
  // Session time handler
  // ------------------------------------------------------------------
  const handleSessionTimeSelect = useCallback(
    async (time: string) => {
      await updatePreferredSessionTime(time);
      refreshProfile();
    },
    [refreshProfile]
  );

  // ------------------------------------------------------------------
  // Navigation handlers
  // ------------------------------------------------------------------
  const handleSetHomeBeach = useCallback(
    () => router.push("/profile?tab=preferences"),
    [router]
  );

  const handleLogSession = useCallback(
    () => router.push("/profile?tab=sessions"),
    [router]
  );

  const handleInviteFriend = useCallback(() => {}, []);

  const handleSetAlarm = useCallback(() => {}, []);

  const handleShareSession = useCallback(() => {}, []);

  const handleViewSpot = useCallback(
    (spotId: string) => {
      const spot = oracle.remainingSpots.find((r) => r.beach.id === spotId);
      if (!spot?.beach.slug) return;

      const city = spot.beach.city?.toLowerCase().replace(/\s+/g, "-") ?? "";
      const state = spot.beach.state?.toLowerCase() ?? "";
      router.push(`/surf-forecast/${city}-${state}/${spot.beach.slug}`);
    },
    [router, oracle.remainingSpots]
  );

  // ------------------------------------------------------------------
  // Extract top-level data
  // ------------------------------------------------------------------
  const { topRecommendation: topRec, profile, homeBeach } = oracle;
  const forecast = topRec?.forecast;
  const window = topRec?.window;

  // Parse numeric forecast values with safe defaults
  const waveHeight = topRec?.waveHeightBadge ?? forecast?.wave_height ?? "—";
  const swellDir =
    forecast?.swell_1_direction ?? forecast?.wave_direction ?? "W";
  const swellPeriod = parseNumeric(
    forecast?.swell_1_period ?? forecast?.wave_period
  );
  const tideH = parseNumeric(forecast?.tide_height);
  const tideDir: "rising" | "falling" =
    forecast?.tide_status?.toLowerCase().includes("rising") ? "rising" : "falling";
  const waterTemp = parseNumeric(forecast?.water_temp);
  const windSpd = parseNumeric(forecast?.wind_speed);
  const windDir = forecast?.wind_direction ?? "—";
  const score = topRec?.score ?? 0;
  const beachName =
    homeBeach?.name ?? topRec?.beach?.name ?? "Your Beach";

  // Cast once for fields not yet in generated Profile type
  const oracleProfile = profile as unknown as ProfileWithOracle | undefined;
  const preferredTime = oracleProfile?.preferred_session_time ?? null;

  // Best window data
  const bestWindowTime = window?.start ? formatWindowTime(window.start) : "—";
  const bestWindowTitle = getBestWindowTitle(preferredTime, window);
  const bestWindowSubtitle =
    topRec?.reasons?.[0] ?? "Check the forecast for details";

  // Transformed sub-component data (memoised to avoid child re-renders)
  const timeWindows = useMemo(
    () => transformToTimeWindows(oracle.discovery?.recommendations ?? [], topRec),
    [oracle.discovery?.recommendations, topRec]
  );
  const nearbySpots = useMemo(
    () => transformToNearbySpots(oracle.remainingSpots),
    [oracle.remainingSpots]
  );
  const activityItems = useMemo(
    () => transformActivityItems(activityRaw ?? []),
    [activityRaw]
  );

  // Build forecast deep-link for the home beach
  const forecastUrl =
    homeBeach?.slug && homeBeach.city && homeBeach.state
      ? `/surf-forecast/${homeBeach.city.toLowerCase().replace(/\s+/g, "-")}-${homeBeach.state.toLowerCase()}/${homeBeach.slug}`
      : undefined;

  // ------------------------------------------------------------------
  // Loading gate
  // ------------------------------------------------------------------
  if (oracle.discoveryLoading && !topRec) {
    return <LoadingSkeleton />;
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#252D6B]">
    <div className="mx-auto max-w-3xl">
      <OracleHero
        beachName={beachName}
        heroPhotoUrl={oracle.heroPhotoUrl}
        waveHeight={waveHeight}
        score={Math.min(score / 10, 9.9)}
        swellDirection={swellDir}
        swellPeriod={swellPeriod}
        tideHeight={tideH}
        tideDirection={tideDir}
        waterTemp={waterTemp}
        windSpeed={windSpd}
        windDirection={windDir}
        bestWindowTitle={bestWindowTitle}
        bestWindowSubtitle={bestWindowSubtitle}
        bestWindowTime={bestWindowTime}
        shouldAnimate={oracle.shouldAnimate}
        onAnimationComplete={oracle.markAnimationPlayed}
        userName={profile?.display_name ?? profile?.full_name}
        levelTitle={oracleProfile?.level_title ?? null}
        xpTotal={oracleProfile?.xp_total ?? null}
      />

      {/* Inline session time selector — only shows when preference is not yet set */}
      {preferredTime === null && (
        <div className="px-6 py-4">
          <SessionTimeSelector onSelect={handleSessionTimeSelect} currentValue={null} />
        </div>
      )}

      {/* TODO: Wire hasSessionToday (check sessions table for today) and
           hasFollows (check follows count) to enable "Share your session"
           and "Tell your crew" CTA branches. */}
      <ContextualCTA
        hasHomeBeach={!!homeBeach}
        hasSessionToday={false}
        hasFollows={false}
        conditionsGood={score > 60}
        preferredTime={preferredTime}
        onSetHomeBeach={handleSetHomeBeach}
        onLogSession={handleLogSession}
        onInviteFriend={handleInviteFriend}
        onSetAlarm={handleSetAlarm}
        onShareSession={handleShareSession}
      />

      <div className="space-y-6 px-6 pb-24">
        <TodaysWindows
          windows={timeWindows}
          preferredTime={preferredTime}
          forecastUrl={forecastUrl}
        />

        <NearbySpots
          spots={nearbySpots}
          onViewSpot={handleViewSpot}
          loading={oracle.discoveryLoading}
        />

        <ActivityFeed items={activityItems} />
      </div>

      <BottomNav />
    </div>
    </div>
  );
}
