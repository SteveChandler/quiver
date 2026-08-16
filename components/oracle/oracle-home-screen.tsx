"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOracleData } from "@/hooks/use-oracle-data";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getLocalActivity } from "@/actions/oracle-actions";
import { HomeCallPlate } from "@/components/oracle/zine/home-call-plate";
import { HomeZineShell } from "@/components/oracle/zine/home-zine-shell";
import {
  HomeZineEmpty,
  HomeZineLoading,
  HomeZineRechecking,
} from "@/components/oracle/zine/home-zine-states";
import { ContextualCTA } from "@/components/oracle/contextual-cta";
import { TodaysWindows } from "@/components/oracle/todays-windows";
import { NearbySpots } from "@/components/oracle/nearby-spots";
import { ActivityFeed } from "@/components/oracle/activity-feed";
import { HomeBeachCard } from "@/components/oracle/home-beach-card";
import { SessionIntelligenceModule } from "@/components/home-screen/session-intelligence-module";
import {
  bearingFromTo,
  calculateDistanceInMiles,
} from "@/lib/utils/distance-utils";
// SessionTimeSelector + updatePreferredSessionTime import removed in
// plan E2 — the inline home-screen prompt is gone. The selector
// component + server action remain available for a future settings
// surface but are no longer wired to the Oracle home screen.
import { BottomNav } from "@/components/home-screen/bottom-nav";
import { InviteSheet } from "@/components/oracle/invite-sheet";
import { ShareSheet } from "@/components/share/share-sheet";
import { buildSurfCallShareData } from "@/lib/share/share-data-builder";
import type { ActivityItem } from "@/components/oracle/activity-feed";
import type { TimeWindow } from "@/components/oracle/todays-windows";
import type { NearbySpot } from "@/components/oracle/nearby-spots";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import { buildRecommendationLogUrl } from "@/lib/recommendations/attribution";
import type { LocalActivityItem } from "@/actions/oracle-actions";
import type { CanonicalDecisionVerdict } from "@/lib/recommendations/canonical-decision/types";
import { isFutureDayInTimezone } from "@/lib/utils/condition-tier-utils";
import { getHourInTimezone, getMinuteInTimezone } from "@/lib/utils/date-time";
import { track } from "@/lib/analytics";
import { updateProfile } from "@/actions/profile-actions";
import { useOnboardingStore } from "@/store/onboarding-store";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
const EMPTY_RECOMMENDATIONS: SurfDiscoveryRecommendation[] = [];

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
function parseNumeric(value: string | number | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === "number") return isNaN(value) ? fallback : value;
  if (!value) return fallback;
  const match = value.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : fallback;
}

/**
 * Format a Date to short time string like "5:45am" or "11:30am".
 */
function formatWindowTime(date: Date, timezone: string): string {
  const hours = getHourInTimezone(date, timezone);
  const minutes = getMinuteInTimezone(date, timezone);
  const period = hours < 12 ? "am" : "pm";
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
  window: SurfDiscoveryRecommendation["window"] | undefined,
  isTomorrow: boolean
): string {
  if (!window) return "Surf's looking good";

  const hour = getHourInTimezone(window.start, window.timezone || "America/Los_Angeles");

  if (isTomorrow) {
    if (hour < 8) return "Tomorrow's dawn patrol";
    if (hour < 12) return "Tomorrow morning looks glassy";
    if (hour < 14) return "Tomorrow's lunchtime waves";
    if (hour < 17) return "Tomorrow afternoon lined up";
    return "Tomorrow evening lined up";
  }

  if (hour < 8) return "Dawn patrol is your move";
  if (hour < 12) return "Morning is looking glassy";
  if (hour < 14) return "Lunchtime waves are on";
  if (hour < 17) return "Afternoon session lined up";
  return "Evening session incoming";
}

function getCanonicalDecisionTitle(
  verdict: CanonicalDecisionVerdict | null,
  isTomorrow: boolean,
  fallbackWindow: SurfDiscoveryRecommendation["window"] | undefined
): string {
  if (!verdict) return getBestWindowTitle(fallbackWindow, isTomorrow);

  if (verdict === "go") {
    return isTomorrow ? "Tomorrow looks worth it" : "Worth paddling out";
  }

  if (verdict === "maybe") {
    return isTomorrow ? "Tomorrow has a narrow window" : "Small window if you time it";
  }

  return isTomorrow ? "Tomorrow looks poor" : "Today's a no-go";
}

function getCanonicalDecisionTime(
  verdict: CanonicalDecisionVerdict | null,
  selectedWindowStart: string | null,
  timezone: string,
  fallbackWindow: SurfDiscoveryRecommendation["window"] | undefined
): string {
  if (!verdict) {
    return fallbackWindow?.start ? formatWindowTime(fallbackWindow.start, timezone) : "—";
  }

  if (verdict === "no") return "—";

  return selectedWindowStart
    ? formatWindowTime(new Date(selectedWindowStart), timezone)
    : "—";
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
/**
 * Extract tide/wind/swell condition fields from a forecast entity.
 */
function extractConditions(f: SurfDiscoveryRecommendation["forecast"]) {
  return {
    swellPeriod: f.swell_1_period ?? f.wave_period ?? undefined,
    swellDirection: f.swell_1_direction ?? f.wave_direction ?? undefined,
    windSpeed: f.wind_speed ?? undefined,
    windDirection: f.wind_direction ?? undefined,
    tideHeight: f.tide_height ?? undefined,
    tideStatus: f.tide_status ?? undefined,
  };
}

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

  const bestHour = getHourInTimezone(topRec.window.start, topRec.window.timezone || "America/Los_Angeles");
  const bestScore = topRec.score / 100; // normalise 0-100 → 0-1
  const waveHeight = topRec.waveHeightBadge ?? topRec.forecast.wave_height ?? "—";
  const topConditions = extractConditions(topRec.forecast);
  // Calibration is keyed on the SOURCE BEACH. The top rec, every synthetic
  // fallback slot, and any slot using `topRec.slotForecasts[hour]` ALL
  // render data from the top rec's same beach (see
  // surf-discovery-orchestrator.ts:758 — slotForecasts is built from
  // `forecastsByBeachId.get(topRec.beach.id)`, i.e. hourly forecasts for the
  // same beach at different times of day). So they share the top rec's
  // calibration state. Only matched-rec slots — windows that found a
  // DIFFERENT recommendation for that hour — get their own per-rec
  // calibration. Earlier code review (I4) incorrectly assumed synthetic
  // slots were for different beaches and stamped them undefined; that
  // produced an asymmetric label render in TodaysWindows where some cards
  // showed "Face height" and others showed nothing.
  const topIsCalibrated = topRec.forecast.isCalibrated;

  return TIME_SLOT_HOURS.map(({ time, hour, label }) => {
    // Check if this slot covers the top rec's window start
    const isBest =
      bestHour >= hour && bestHour < hour + 3;

    let quality: number;
    let slotLabel: string;
    let height: string;
    let conditions = topConditions;
    let isCalibrated: boolean | undefined;

    if (isBest) {
      quality = bestScore;
      slotLabel = topRec.summary.length > 0 ? topRec.summary : label;
      height = waveHeight;
      isCalibrated = topIsCalibrated;
    } else {
      // Check if another recommendation lands in this slot
      const matchedRec = recommendations.find((r) => {
        const h = getHourInTimezone(r.window.start, r.window.timezone || "America/Los_Angeles");
        return h >= hour && h < hour + 3;
      });

      if (matchedRec) {
        quality = matchedRec.score / 100;
        height = matchedRec.waveHeightBadge ?? matchedRec.forecast.wave_height ?? "—";
        slotLabel = label;
        conditions = extractConditions(matchedRec.forecast);
        isCalibrated = matchedRec.forecast.isCalibrated;
      } else {
        // Synthetic fallback: quality degrades away from the best slot.
        // The slot data — when present — is hourly forecast data from the
        // top rec's SAME beach (see comment on topIsCalibrated above). So
        // calibration matches the top rec.
        isCalibrated = topIsCalibrated;
        const hourDiff = Math.abs(hour - bestHour);
        quality = Math.max(0.1, bestScore - hourDiff * 0.15);
        slotLabel = label;
        // Use per-slot wave height and conditions when available (from slotForecasts on the top rec)
        const slotData = topRec.slotForecasts?.[hour];
        height = slotData?.waveHeightBadge ?? slotData?.waveHeight ?? waveHeight;
        if (slotData) {
          conditions = {
            swellPeriod: slotData.swellPeriod ?? topConditions.swellPeriod,
            swellDirection: slotData.swellDirection ?? topConditions.swellDirection,
            windSpeed: slotData.windSpeed ?? topConditions.windSpeed,
            windDirection: slotData.windDirection ?? topConditions.windDirection,
            tideHeight: slotData.tideHeight ?? topConditions.tideHeight,
            tideStatus: slotData.tideStatus ?? topConditions.tideStatus,
          };
        }
      }
    }

    return { time, label: slotLabel, height, quality, isBest, isCalibrated, ...conditions };
  });
}

/**
 * Skill level ordering for comparison.
 */
const SKILL_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

/**
 * Minimal hero-context shape used inside the transform layer to personalize
 * backup-spot reasons. Built from `heroSurfCall` (a `SurfCallResult`) using
 * its real field names — `windDirection` and `windSpeedKnots` do NOT exist
 * on SurfCallResult. Keep this local; nothing outside the transform should
 * depend on it.
 */
type HeroReasonContext = {
  verdict?: "YES" | "MAYBE" | "NO";
};

function toLegacySurfVerdict(
  verdict: CanonicalDecisionVerdict | null,
): HeroReasonContext["verdict"] | undefined {
  if (verdict === "go") return "YES";
  if (verdict === "maybe") return "MAYBE";
  if (verdict === "no") return "NO";
  return undefined;
}

function isCustomSpotRecommendation(rec: SurfDiscoveryRecommendation | null | undefined): boolean {
  return rec?.kind === "custom_spot" && !!rec.customSpotId;
}

function getRecommendationIdentity(rec: SurfDiscoveryRecommendation): string {
  return isCustomSpotRecommendation(rec)
    ? `custom:${rec.customSpotId}`
    : `beach:${rec.beach.id}`;
}

/**
 * Build a short, hero-relative reason string for a backup spot card.
 *
 * Rules — separation of authority (see memory pin
 * `feedback_separate_ranking_from_verdict_authority`): discovery picks WHICH
 * beach a card is for; verdict copy is decided here at render-prep time
 * against the hero call. Strategy-tag classification stays in
 * `lib/services/discovery/strategy-tags.ts` and is NOT modified.
 *
 * Conservative copy ONLY — never claim wind orientation, glassiness, or
 * "hero closes" unless backed by a real source of truth carried in the
 * code. Returning `null` lets the caller fall back to the existing
 * `strategyTag.reason`, then to `rec.summary`.
 */
function buildPersonalizedReason(
  rec: SurfDiscoveryRecommendation,
  hero?: HeroReasonContext
): string | null {
  const tag = rec.strategyTag?.type;
  if (!tag || !hero) return null;

  if (tag === "biggest_waves" && hero.verdict === "MAYBE") {
    return "More size than the hero call";
  }
  if (tag === "sleep_in") {
    return "Better if you miss the early window";
  }
  if (tag === "low_crowd" && hero.verdict === "YES") {
    return "Fallback if the hero spot gets crowded";
  }
  if (tag === "skip" && hero.verdict === "NO") {
    return "Likely the same problem as the hero spot";
  }
  if (tag === "cleanest") {
    return "Cleaner backup than the hero spot";
  }
  return null;
}

/**
 * Map remaining spots to the NearbySpot shape.
 *
 * `heroContext` is consumed only to derive `reasonText` via
 * `buildPersonalizedReason`. NearbySpot itself does not carry forecast
 * fields, so any hero-relative copy must be decided here while the full
 * `SurfDiscoveryRecommendation` is in scope.
 */
function transformToNearbySpots(
  remainingSpots: SurfDiscoveryRecommendation[],
  userSkillLevel: string | null,
  heroContext?: HeroReasonContext
): NearbySpot[] {
  const userRank = SKILL_RANK[userSkillLevel ?? ""] ?? -1;
  return remainingSpots.map((rec) => {
    const beachRank = SKILL_RANK[rec.beach.skill_level?.toLowerCase() ?? ""] ?? 1;
    const waveHeight = parseFloat(String(rec.forecast.wave_height ?? "0"));
    // Show skill mismatch when beach exceeds user level AND conditions are non-trivial
    const skillMismatch = userRank >= 0 && beachRank > userRank && waveHeight > 2;
    const isCustom = isCustomSpotRecommendation(rec);
    return {
      id: getRecommendationIdentity(rec),
      kind: isCustom ? "custom_spot" : "beach",
      beachId: rec.beach.id,
      customSpotId: isCustom ? rec.customSpotId ?? null : null,
      name: rec.beach.name,
      conditions: rec.summary,
      height: rec.waveHeightBadge ?? rec.forecast.wave_height ?? "—",
      photoUrl: rec.beach.photo_url ?? null,
      score: rec.score,
      skillMismatch,
      strategyTag: rec.strategyTag,
      reasonText:
        buildPersonalizedReason(rec, heroContext) ??
        rec.strategyTag?.reason ??
        rec.summary,
    };
  });
}

/**
 * Transform raw LocalActivityItem[] (from server action) to ActivityItem[].
 */
function transformActivityItems(raw: LocalActivityItem[]): ActivityItem[] {
  return raw.map((item) => ({
    id: item.id,
    userName: item.userName,
    action: item.action,
    content: item.content,
    timeAgo: formatTimeAgo(item.createdAt),
    initial: (item.userName[0] ?? "?").toUpperCase(),
    type: item.type,
  }));
}

// ============================================================================
// OracleHomeScreen
// ============================================================================

export function OracleHomeScreen() {
  const oracle = useOracleData();
  const router = useRouter();
  const { refreshProfile } = oracle;

  // Invite-a-friend sheet state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Session share sheet state
  const [shareOpen, setShareOpen] = useState(false);

  // ------------------------------------------------------------------
  // Extract top-level data + derive hero/home semantics
  //
  // Hero is ALWAYS the regional best (topRec). The previous behavior —
  // forcing the hero to the user's home beach whenever home was inside
  // the discovery radius — suppressed cross-beach ranking ("drive 18 mi
  // north to The Rock" never surfaced for a SD user with OB Pier as
  // home). We surface that override-suppressed signal via two pieces of
  // UI: a "↗ N mi {direction} of {homeBeach}" subtitle on the hero, and
  // a labeled "Your home" card below the hero. When `topRec` is null the
  // screen falls through to `OracleHeroEmpty` below — no synthesized
  // fallback to bare homeBeach.
  // ------------------------------------------------------------------
  const recommendationsUnavailable =
    oracle.discovery?.recommendationAvailability?.state === "none";
  const sessionDecision = oracle.discovery?.sessionDecision ?? null;
  const selectedCandidate = sessionDecision?.selection;
  const topCandidate = oracle.topRecommendation;
  const decisionExpiresAt = Date.parse(sessionDecision?.expiresAt ?? "");
  const selectionMatchesTop =
    sessionDecision?.verdict !== "no" &&
    Number.isFinite(decisionExpiresAt) &&
    Date.now() < decisionExpiresAt &&
    selectedCandidate !== null &&
    selectedCandidate !== undefined &&
    topCandidate?.recommendationId === selectedCandidate.candidateId &&
    topCandidate.beach.id === selectedCandidate.beachId;
  const topRec =
    recommendationsUnavailable || !selectionMatchesTop ? null : topCandidate;
  const effectiveRecommendations = useMemo(
    () => topRec ? [topRec] : EMPTY_RECOMMENDATIONS,
    [topRec],
  );
  const canonicalVerdict: CanonicalDecisionVerdict | null = selectionMatchesTop
    ? sessionDecision?.verdict ?? null
    : null;
  const { profile, homeBeach } = oracle;

  const homeBeachRec = useMemo(() => {
    if (!homeBeach?.id) return null;
    return effectiveRecommendations.find(
      r => !isCustomSpotRecommendation(r) && r.beach.id === homeBeach.id
    ) ?? null;
  }, [homeBeach?.id, effectiveRecommendations]);

  const heroRec = topRec;
  const heroBeach = heroRec?.beach;

  // Latches once a real call has been on screen. Distinguishes a cold load
  // (nothing has ever rendered) from a recheck (we had a call and discovery
  // dropped it to re-verify), which want different empty-of-data pages.
  //
  // Scoped to the profile: signing in as someone else without remounting this
  // component would otherwise inherit the previous user's latch and greet them
  // with "rechecking" for a call they have never seen.
  const hasShownCallRef = useRef(false);
  const latchedProfileIdRef = useRef<string | null>(null);
  const currentProfileId = profile?.id ?? null;
  useEffect(() => {
    if (latchedProfileIdRef.current !== currentProfileId) {
      latchedProfileIdRef.current = currentProfileId;
      hasShownCallRef.current = false;
    }
    if (heroRec) hasShownCallRef.current = true;
  }, [heroRec, currentProfileId]);
  const hasShownCall =
    hasShownCallRef.current && latchedProfileIdRef.current === currentProfileId;

  const homeIsTopRec =
    !!homeBeach?.id &&
    !isCustomSpotRecommendation(topRec) &&
    topRec?.beach.id === homeBeach.id;
  const showHomeCard = !!homeBeach && !!homeBeachRec && !homeIsTopRec;

  // ------------------------------------------------------------------
  // Activity fetch — follows the hero (per 2026-04-25 product decision,
  // memory: project_oracle_activity_feed_follows_hero.md). Falls back
  // to home beach when topRec is null.
  // ------------------------------------------------------------------
  const activityBeachId = heroBeach?.id ?? homeBeach?.id ?? null;

  const fetchActivity = useCallback(async (): Promise<LocalActivityItem[]> => {
    if (!activityBeachId) return [];
    const result = await getLocalActivity(activityBeachId);
    return result?.data ?? [];
  }, [activityBeachId]);

  const { data: activityRaw } = useDataFetcher(fetchActivity, {
    skip: !activityBeachId,
  });

  // Session time handler removed with the inline SessionTimeSelector
  // mount — plan E2. `updatePreferredSessionTime` (in actions/oracle-
  // actions.ts) is still exported for a future settings surface; see
  // git history for the useCallback wrapper pattern used here.

  // ------------------------------------------------------------------
  // Navigation handlers
  // ------------------------------------------------------------------
  const { reset: resetOnboarding, openDialog: openOnboardingDialog } =
    useOnboardingStore();
  const handleSetHomeBeach = useCallback(() => {
    // Open the onboarding dialog in-place. Brand-new users have no
    // onboarding_completed_at set, so reset() + openDialog() suffices
    // (no reopenOnboarding() server action needed — that's only for users
    // who previously tapped "Maybe later"). See plan vast-dancing-whale.
    resetOnboarding();
    openOnboardingDialog();
  }, [resetOnboarding, openOnboardingDialog]);

  const handleLogSession = useCallback(
    () => {
      if (!heroRec) {
        router.push("/sessions/new?mode=log");
        return;
      }

      router.push(
        buildRecommendationLogUrl({
          recommendation: heroRec,
          rank: 1,
          surface: "home_hero",
        })
      );
    },
    [heroRec, router]
  );

  // Build share data for the session share sheet (needed by handleShareSession below)
  const shareData = useMemo(() => {
    if (!heroRec) return null;
    return buildSurfCallShareData({
      recommendation: heroRec,
      sessionDecision,
    });
  }, [heroRec, sessionDecision]);

  // ------------------------------------------------------------------
  // Action handlers
  // ------------------------------------------------------------------
  const handleInviteFriend = useCallback(() => {
    track("invite_friend_clicked");
    // Open sheet immediately — referral code loads in the background
    setInviteOpen(true);

    if (!referralCode) {
      import("@/actions/referral-actions")
        .then(({ getOrCreateReferralCode }) => getOrCreateReferralCode())
        .then((result) => {
          if (result?.data?.code) {
            setReferralCode(result.data.code);
            track("referral_code_generated", { code: result.data.code });
          }
        })
        .catch((err) => {
          console.warn("[InviteFriend] Referral code generation failed:", err);
          track("referral_code_failed");
        });
    }
  }, [referralCode]);

  const handleSetAlarm = useCallback(async () => {
    track("set_alarm_clicked", { beach_id: homeBeach?.id });

    if (!homeBeach) {
      const { toast } = await import("sonner");
      toast("Set your home beach first", {
        description: "Go to a beach page and tap 'Set Home Beach' to enable alerts.",
      });
      return;
    }

    const result = await updateProfile({
      notif_email_enabled: true,
      notif_forecast_alerts: true,
    });
    const { toast } = await import("sonner");
    if (result && "error" in result && result.error) {
      toast.error("Failed to enable alerts. Try again.");
    } else {
      toast("Forecast alerts enabled!", {
        description: "We'll email you when conditions line up at " + homeBeach.name + ".",
      });
      track("forecast_alerts_enabled", { beach_id: homeBeach.id });
    }
  }, [homeBeach]);

  const handleShareSession = useCallback(() => {
    track("share_session_clicked", { beach_id: heroRec?.beach?.id });
    if (!shareData) {
      import("sonner").then(({ toast }) =>
        toast("No session data to share yet.", { description: "Check back once we have conditions loaded." })
      );
      return;
    }
    setShareOpen(true);
  }, [shareData, heroRec?.beach?.id]);

  const handleViewSpot = useCallback(
    (spotId: string) => {
      const spot = effectiveRecommendations.find(
        (r) =>
          getRecommendationIdentity(r) === spotId ||
          (!isCustomSpotRecommendation(r) && r.beach.id === spotId)
      );
      if (!spot || isCustomSpotRecommendation(spot)) return;
      if (!spot?.beach.slug) return;

      const city = spot.beach.city?.toLowerCase().replace(/\s+/g, "-") ?? "";
      const state = spot.beach.state?.toLowerCase() ?? "";
      router.push(`/${state}/${city}/${spot.beach.slug}`);
    },
    [effectiveRecommendations, router]
  );

  // Drive subtitle context: "↗ N mi {direction} of {homeBeach}". Only
  // populated when the hero is a beach OTHER than the user's home beach
  // and we have valid coords on both sides. The beaches table uses
  // lat/lon (verified via types/database.generated.ts and existing reads
  // at hooks/use-oracle-data.ts:108).
  const driveContext = useMemo(() => {
    if (homeIsTopRec || !homeBeach || !heroBeach) return undefined;
    if (homeBeach.lat == null || homeBeach.lon == null) return undefined;
    if (heroBeach.lat == null || heroBeach.lon == null) return undefined;
    const home = { lat: homeBeach.lat, lon: homeBeach.lon };
    const hero = { lat: heroBeach.lat, lon: heroBeach.lon };
    const distanceMiles = calculateDistanceInMiles(home, hero);
    if (!Number.isFinite(distanceMiles) || distanceMiles < 1) return undefined;
    return {
      distanceMiles,
      bearing: bearingFromTo(home, hero),
      homeBeachName: homeBeach.name,
    };
  }, [homeIsTopRec, homeBeach, heroBeach]);

  const forecast = heroRec?.forecast;
  const window = heroRec?.window;

  // Parse numeric forecast values with safe defaults
  const waveHeight = heroRec?.waveHeightBadge ?? forecast?.wave_height ?? "—";
  // Use per-slot data for current hour (fixes stale tide direction)
  const heroTz = window?.timezone || "America/Los_Angeles";
  const currentHour = getHourInTimezone(new Date(), heroTz);
  const currentSlotHour = TIME_SLOT_HOURS.reduce((closest, slot) =>
    Math.abs(slot.hour - currentHour) < Math.abs(closest.hour - currentHour) ? slot : closest
  ).hour;
  const currentSlot = heroRec?.slotForecasts?.[currentSlotHour];

  // Keep the hero's "current conditions" strip coherent: when we have a
  // current slot for the beach/day, use that same slot for swell + wind.
  // The previous implementation mixed slot wind with best-window swell,
  // which could show conditions from different hours in the same hero.
  const swellDir =
    currentSlot?.swellDirection ??
    forecast?.swell_1_direction ??
    forecast?.wave_direction ??
    "W";
  const swellPeriod = parseNumeric(
    currentSlot?.swellPeriod ??
    forecast?.swell_1_period ??
    forecast?.wave_period
  );

  const tideH = parseNumeric(currentSlot?.tideHeight ?? forecast?.tide_height);
  const tideDir: "rising" | "falling" =
    (currentSlot?.tideStatus ?? forecast?.tide_status)?.toLowerCase().includes("rising")
      ? "rising" : "falling";
  const waterTemp = parseNumeric(forecast?.water_temp);
  const windSpd = parseNumeric(currentSlot?.windSpeed ?? forecast?.wind_speed);
  const windDir = currentSlot?.windDirection ?? forecast?.wind_direction ?? "—";
  const score: number | null = null;
  const beachName = heroRec?.beach?.name ?? homeBeach?.name ?? "Your Beach";

  // Cast once for fields not yet in generated Profile type
  const oracleProfile = profile as unknown as ProfileWithOracle | undefined;
  const preferredTime = oracleProfile?.preferred_session_time ?? null;

  // Check if the top recommendation is for tomorrow (timezone-aware).
  // Read from the freshness-gated payload, not raw heroSurfCallData — a
  // stale response from a previous hero beach must not flip the
  // "tomorrow"/"today" framing on the new hero.
  const isTomorrow = useMemo(() => {
    const selectedStart = selectedCandidate?.windowStart;
    if (selectedStart) {
      return isFutureDayInTimezone(new Date(selectedStart), heroTz);
    }
    if (!window?.start) return false;
    return isFutureDayInTimezone(window.start, heroTz);
  }, [selectedCandidate?.windowStart, window?.start, heroTz]);

  // Best window data
  const bestWindowTime = getCanonicalDecisionTime(
    canonicalVerdict,
    selectedCandidate?.windowStart ?? null,
    heroTz,
    window,
  );
  const bestWindowTitle = getCanonicalDecisionTitle(
    canonicalVerdict,
    isTomorrow,
    window,
  );
  // Supporting line *inside* the best-window card. Must NOT be sourced from
  // `heroSurfCall?.whySentence` — that sentence renders as its own distinct
  // prose line under the card (passed separately as `whySentence` below).
  // Sourcing both from the same signal would render the same sentence twice.
  const bestWindowSubtitle =
    heroRec?.reasons?.[0] ?? "Check the forecast for details";

  // Transformed sub-component data (memoised to avoid child re-renders)
  const timeWindows = useMemo(
    () => transformToTimeWindows(effectiveRecommendations, heroRec),
    [effectiveRecommendations, heroRec]
  );
  // Hero context used to personalize backup-spot reasons in the transform
  // layer. Built from the freshness-gated `heroSurfCall` (see
  // `heroSurfCallFresh` above) — never from raw `heroSurfCallData`, or a
  // stale beach-A response would briefly drive backup copy on beach B.
  // Memoised so `nearbySpots`'s useMemo doesn't recompute every render.
  const heroReasonContext = useMemo<HeroReasonContext | undefined>(() => {
    const verdict = toLegacySurfVerdict(canonicalVerdict);
    return verdict ? { verdict } : undefined;
  }, [canonicalVerdict]);

  const nearbySpots = useMemo(() => {
    const heroIdentity = heroRec ? getRecommendationIdentity(heroRec) : null;
    const spots = effectiveRecommendations
      .filter(r => getRecommendationIdentity(r) !== heroIdentity)
      .sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
    return transformToNearbySpots(spots, oracle.userSkillLevel, heroReasonContext);
  }, [
    effectiveRecommendations,
    heroRec,
    oracle.userSkillLevel,
    heroReasonContext,
  ]);
  const activityItems = useMemo(
    () => transformActivityItems(activityRaw ?? []),
    [activityRaw]
  );

  // Build forecast deep-link for the hero beach
  const forecastUrl =
    heroBeach?.slug && heroBeach.city && heroBeach.state
      ? `/${heroBeach.state.toLowerCase()}/${heroBeach.city.toLowerCase().replace(/\s+/g, "-")}/${heroBeach.slug}`
      : undefined;

  // ------------------------------------------------------------------
  // Loading vs empty gate
  //
  // The empty state must only paint after the bootstrap has *converged* —
  // either discovery has a definitive answer (data or error) OR the upstream
  // gates that hold discovery off (profileLoading, geoLoading) have settled.
  // Without this, fresh authenticated users see a "We couldn't find any surf
  // spots" card flash before discovery even runs, because useSurfDiscovery is
  // gated by `enabled: !!profile && !geoLoading` — when those are still
  // pending, discoveryLoading is false AND discovery is null.
  // ------------------------------------------------------------------
  const hasDefinitiveDiscoveryAnswer =
    oracle.discovery !== null || !!oracle.discoveryError;
  const isBootstrapping =
    oracle.profileLoading ||
    (oracle.geoLoading && !hasDefinitiveDiscoveryAnswer) ||
    oracle.discoveryLoading ||
    (!!oracle.profile && !hasDefinitiveDiscoveryAnswer);

  // Two different situations hide behind "no hero yet", and they deserve
  // different pages.
  //
  // A cold load has genuinely never shown anything. A recheck HAS — the user
  // was looking at a call, switched tabs, and discovery dropped its payload on
  // resume so a safety hold activated while they were away can't lose to the
  // stale positive still on screen (see hooks/use-surf-discovery.ts). Both
  // used to render the same full-bleed navy skeleton, so the recheck looked
  // like the page had crashed and reloaded itself.
  if (!heroRec && isBootstrapping) {
    return hasShownCall ? (
      <HomeZineRechecking beachName={homeBeach?.name ?? null} />
    ) : (
      <HomeZineLoading />
    );
  }

  // Empty / error state — bootstrap converged but no usable hero. Render an
  // honest empty card with a retry affordance instead of letting
  // `parseNumeric(undefined) → 0` leak phantom zeros into the hero UI.
  if (!heroRec) {
    const reason = recommendationsUnavailable
      ? "Session picks aren't available right now."
      : oracle.discoveryError
        ? "We couldn't load conditions for your area."
        : "We couldn't find any surf spots near you right now.";
    return (
      <HomeZineEmpty
        beachName={homeBeach?.name ?? "Your Surf"}
        reason={reason}
        onSetHomeBeach={
          recommendationsUnavailable || homeBeach
            ? undefined
            : handleSetHomeBeach
        }
        onRetry={
          recommendationsUnavailable
            ? undefined
            : () => globalThis.location.reload()
        }
      />
    );
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <HomeZineShell>
      <HomeCallPlate
        beachName={beachName}
        heroPhotoUrl={oracle.heroPhotoUrl}
        verdict={canonicalVerdict}
        waveHeight={waveHeight}
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
        isTomorrow={isTomorrow}
        greeting={oracle.discovery?.regionalCall || undefined}
        userName={profile?.display_name ?? profile?.full_name}
        levelTitle={oracleProfile?.level_title ?? null}
        xpTotal={oracleProfile?.xp_total ?? null}
        driveContext={driveContext}
      />

      {/* Labeled "Your home" card surfaced when the regional best is a
          different beach than the user's home. Click navigates to beach
          detail via the same handler NearbySpots uses. */}
      {showHomeCard && homeBeachRec && (
        <div className="pt-6">
          <HomeBeachCard rec={homeBeachRec} onClick={handleViewSpot} />
        </div>
      )}

      {/* Inline SessionTimeSelector prompt removed in plan E2. Asking
          users "When do you usually paddle out?" on the home screen
          was the same zero-value capture as the onboarding step we
          dropped — it wrote to `profiles.preferred_session_time` but
          the question itself was friction without an obvious payoff
          for a user just trying to see their forecast. Downstream
          logic (TodaysWindows, ContextualCTA) already handles
          `preferredTime === null` gracefully; windows just aren't
          pre-filtered by the user's usual paddle time. If/when we
          want this as a preference again it should live in a quieter
          settings surface, not as a full-width prompt above the
          primary CTA. Plan: abstract-exploring-phoenix (E2). */}

      {/* 2-column at lg+: left = CTA + Windows, right = Nearby + Activity.
          On mobile this falls back to a single stacked column automatically. */}
      {/* TODO: Wire hasSessionToday (check sessions table for today) and
           hasFollows (check follows count) to enable "Share your session"
           and "Tell your crew" CTA branches. */}
      <div
        className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8"
        data-testid="oracle-home-content-grid"
      >
        {/* Left column: CTA + Today's Windows */}
        <div className="min-w-0 space-y-8">
          <ContextualCTA
            hasHomeBeach={!!homeBeach}
            hasSessionToday={false}
            hasFollows={false}
            conditionsGood={canonicalVerdict === "go"}
            surfVerdict={toLegacySurfVerdict(canonicalVerdict)}
            preferredTime={preferredTime}
            onSetHomeBeach={handleSetHomeBeach}
            onLogSession={handleLogSession}
            onInviteFriend={handleInviteFriend}
            onSetAlarm={handleSetAlarm}
            onShareSession={handleShareSession}
          />

          <TodaysWindows
            windows={timeWindows}
            preferredTime={preferredTime}
            forecastUrl={forecastUrl}
            isTomorrow={isTomorrow}
            eveningTransition={oracle.discovery?.eveningTransition}
          />
        </div>

        {/* Right column: Nearby Spots + Activity Feed */}
        <div className="mt-8 min-w-0 space-y-8 lg:mt-0">
          <NearbySpots
            spots={nearbySpots}
            onViewSpot={handleViewSpot}
            // Only claim "loading" when there is nothing to show. A background
            // revalidation must not swap resolved cards back to skeletons.
            loading={oracle.discoveryLoading && nearbySpots.length === 0}
            onUseMyLocation={
              oracle.geoSource === "browser" ? undefined : oracle.requestLocation
            }
            locationLoading={oracle.geoLoading}
          />

          {activityItems.length > 0 && (
            <ActivityFeed items={activityItems} />
          )}
        </div>
      </div>

      {/* Keyed off having recommendations rather than the loading flag, so a
          background refresh doesn't unmount the module and pop the layout. */}
      {effectiveRecommendations.length > 0 && (
        <div className="mt-8">
          <SessionIntelligenceModule
            recommendations={effectiveRecommendations}
            recommendationAvailability={
              oracle.discovery?.recommendationAvailability
            }
          />
        </div>
      )}

      <div className="pb-20 lg:pb-0" />
      <BottomNav />

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        referralCode={referralCode}
      />

      {shareData && (
        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          imageUrl={shareData.imageUrl}
          type="wave"
          filename={`quiver-surf-call-${heroRec?.beach?.slug || "beach"}`}
          title={shareData.title}
          text={shareData.text}
          shareUrl={forecastUrl ? `${SITE_URL}${forecastUrl}` : undefined}
        />
      )}
    </HomeZineShell>
  );
}
