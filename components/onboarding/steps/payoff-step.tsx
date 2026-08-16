'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useProfileContext } from '@/context/profile-context';
import { useForecastPreview } from '@/hooks/use-forecast-preview';
import { useTrackEvent } from '@/hooks/use-track-event';
import { saveOnboardingData } from '@/actions/onboarding-actions';
import { data as dataClient } from '@/lib/data/client';
import { getLocalDateString } from '@/lib/utils/timezone-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, MapPin, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { LEVEL_THRESHOLDS } from '@/lib/gamification/constants';
import { WaveParticles } from '../wave-particles';
import type { Profile } from '@/types/database';
import type { ClientBeachDailyIntel } from '@/lib/data/client';

function getRuntimeIanaTimezone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone || timezone.length > 100) return null;
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
}

function formatIntelWaveHeightLabel(intel: ClientBeachDailyIntel): string | null {
  if (intel.best_window_wave_height_label) {
    return intel.best_window_wave_height_label;
  }
  if (intel.current_wave_height_label) {
    return intel.current_wave_height_label;
  }
  if (intel.surf_min_ft == null || intel.surf_max_ft == null) {
    return null;
  }
  return `${Math.round(intel.surf_min_ft)}-${Math.round(intel.surf_max_ft)}ft`;
}

function formatCurrentIntelWaveHeightLabel(
  intel: ClientBeachDailyIntel
): string | null {
  if (intel.current_wave_height_label) {
    return intel.current_wave_height_label;
  }
  if (intel.surf_min_ft == null || intel.surf_max_ft == null) {
    return null;
  }
  return `${Math.round(intel.surf_min_ft)}-${Math.round(intel.surf_max_ft)}ft`;
}

// Animated score counter — displays a spring-animated number with scale pop on finish
function AnimatedScore({ target }: { target: number }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 80, damping: 20 });
  const [display, setDisplay] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    motionValue.set(target);
    setFinished(false);
    const unsubscribe = springValue.on('change', (v) => {
      const rounded = Math.round(v);
      setDisplay(rounded);
      // Detect when spring animation has settled at target
      if (rounded === target && Math.abs(v - target) < 0.5) {
        setFinished(true);
      }
    });
    return unsubscribe;
  }, [target, motionValue, springValue]);

  return (
    <motion.span
      animate={finished ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
    >
      {display}
    </motion.span>
  );
}

export function PayoffStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, completeOnboarding } = useOnboardingStore();
  const { updateProfile } = useProfileContext();
  const { track } = useTrackEvent();
  const reducedMotion = useReducedMotion();

  const [isSaving, setIsSaving] = useState(false);
  const [intel, setIntel] = useState<ClientBeachDailyIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);

  // Beat reveal state: 0 = loading, 1 = beat1 visible, 2 = beat2 visible, 3 = beat3 visible
  const [beat, setBeat] = useState(0);

  const isDebugOnboarding =
    searchParams?.get('debugOnboarding') === '1' &&
    process.env.NODE_ENV !== 'production';

  // Fallback to forecast preview if no intel (skip in debug mode to keep test flow fast)
  const { forecastPreview, loading: forecastLoading } = useForecastPreview({
    enabled: !isDebugOnboarding && !intel && !intelLoading && !!data.homeBeachId,
    beachId: data.homeBeachId,
  });

  // Guard against double-execution (React 18 strict mode, Zustand hydration)
  const hasRun = useRef(false);

  // Read referral code from cookie (set by middleware when user arrives via ?ref=CODE)
  function getReferralCodeFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)qvr_referral_code=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Save logic — invoked from handleFinish when the user commits to finishing.
  // NOTE: do NOT call this on mount. Saving on mount triggers updateProfile() which
  // flows through ProfileContext and races the onboarding dialog's stale-close effect,
  // dismissing the dialog before the user can see the celebration UI or click this button.
  // See `project_onboarding_payoff_step_bug.md`.
  const attemptSave = async (): Promise<boolean> => {
    try {
      const referralCode = getReferralCodeFromCookie() ?? undefined;
      const result = await saveOnboardingData({
        ...data,
        referralCode,
        timezone: getRuntimeIanaTimezone(),
      });

      if (!result.success) {
        track("onboarding_step", {
          metadata: {
            step: "save_failed",
            step_name: "save_failed",
            reason: result.error || "wrapper_failed",
          },
          debounceMs: 0,
        });
        toast.error(result.error || 'Failed to save your preferences. Please try again.');
        return false;
      }

      if (!result.data?.success) {
        track("onboarding_step", {
          metadata: {
            step: "save_failed",
            step_name: "save_failed",
            reason: result.data?.error || "inner_failed",
          },
          debounceMs: 0,
        });
        toast.error(result.data?.error || 'Failed to save your preferences. Please try again.');
        return false;
      }

      if (result.data.profile) {
        updateProfile(result.data.profile as Profile);
      }

      return true;
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
      track("onboarding_step", {
        metadata: {
          step: "save_failed",
          step_name: "save_failed",
          reason: error instanceof Error ? error.message : "exception",
        },
        debounceMs: 0,
      });
      toast.error('Failed to save your preferences. Please try again.');
      return false;
    }
  };

  // On mount: fetch daily intel for the home beach the user just picked (from the
  // Zustand store, not from the profile — the profile isn't saved until handleFinish).
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function fetchIntel() {
      if (isDebugOnboarding) {
        setIntelLoading(false);
        return;
      }

      if (data.homeBeachId) {
        try {
          const todayDate = getLocalDateString(new Date());
          const dailyIntel = await dataClient.intel.getDaily(
            data.homeBeachId,
            todayDate
          );
          setIntel(dailyIntel);
        } catch (error) {
          console.error('Failed to fetch daily intel:', error);
        }
      }
      setIntelLoading(false);
    }

    fetchIntel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = intelLoading || forecastLoading;

  // Start reveal beats once content is loaded — enhanced 3-beat reveal
  useEffect(() => {
    if (isLoading) return;

    if (reducedMotion) {
      // Show everything immediately
      setBeat(3);
      return;
    }

    // Beat 1: immediate — beach name + conditions card slides up
    setBeat(1);

    // Beat 2: 600ms — XP badge sticker slap + emoji confetti
    // shapeFromText exists at runtime but types lag behind
    const shapeFromText = (confetti as any).shapeFromText;
    const surfEmoji = shapeFromText({ text: '🏄‍♂️', scalar: 2 });
    const waveEmoji = shapeFromText({ text: '🌊', scalar: 2 });
    const shakaEmoji = shapeFromText({ text: '🤙', scalar: 2 });
    const fireEmoji = shapeFromText({ text: '🔥', scalar: 2 });

    const t2 = setTimeout(() => {
      setBeat(2);
      // First salvo — colored confetti + emoji mix
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F78E42', '#FFB703', '#FFFFFF', '#00B4D8', '#FF6B6B'],
      });
      confetti({
        particleCount: 12,
        spread: 70,
        origin: { y: 0.6 },
        shapes: [surfEmoji, waveEmoji, shakaEmoji, fireEmoji],
        scalar: 2,
        gravity: 0.7,
        ticks: 250,
      });
      // Second salvo 200ms later — more emoji
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 100,
          origin: { y: 0.55, x: 0.6 },
          colors: ['#F78E42', '#FFB703', '#FFFFFF', '#00B4D8'],
        });
        confetti({
          particleCount: 10,
          spread: 90,
          origin: { y: 0.55, x: 0.6 },
          shapes: [surfEmoji, waveEmoji, shakaEmoji],
          scalar: 2,
          gravity: 0.7,
          ticks: 250,
        });
      }, 200);
    }, 600);

    // Beat 3: 1200ms — CTA button appears with gradient sweep
    const t3 = setTimeout(() => {
      setBeat(3);
    }, 1200);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isLoading, reducedMotion]);

  const handleFinish = async () => {
    // Save onboarding data now (not on mount — see attemptSave comment).
    // Debug mode skips the server round-trip entirely.
    if (!isDebugOnboarding) {
      setIsSaving(true);
      const saved = await attemptSave();
      if (!saved) {
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    // Close the dialog. The OnboardingDialog's stale-close effect is guarded to not
    // fire on PayoffStep, so we drive the close explicitly via completeOnboarding() here.
    completeOnboarding();

    // Refresh cached forecasts so they pick up the new profile context, but DO NOT
    // navigate away from the page the user signed up on. Product intent: keep the
    // user on /map, /beach/:slug, or wherever they were when the dialog appeared.
    router.refresh();

    toast.success('Welcome to Quiver!');
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return time;
    }
  };

  const conditionsScore = intel?.conditions_score ?? null;
  const recommendationHeld =
    intel?.recommendationAvailability?.state === 'none';
  const currentWaveHeightLabel = intel
    ? formatCurrentIntelWaveHeightLabel(intel)
    : null;
  const kookTitle = LEVEL_THRESHOLDS[0].title;

  return (
    <div className="relative space-y-5" data-testid="payoff-step">
      {/* Ambient wave particles behind content */}
      <WaveParticles />

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {/* Pulsing wave icon */}
          <div className="flex justify-center py-4">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-4xl">🌊</span>
            </motion.div>
          </div>
          <Skeleton className="h-6 w-48 bg-white/[0.06]" />
          <Skeleton className="h-32 w-full bg-white/[0.06]" />
          <Skeleton className="h-16 w-full bg-white/[0.06]" />
        </div>
      ) : (
        <>
          {/* Beat 1: Heading + Conditions Card — bouncy spring slide up */}
          {beat >= 1 && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 200, damping: 12 }
              }
              className="space-y-4 relative z-10"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#F78E42]" />
                <h2 className="font-handwritten text-3xl sm:text-4xl text-white">
                  You&apos;re set up for {data.homeBeachName || 'your home beach'}
                </h2>
              </div>

              {/* Objective conditions remain visible when recommendations are held. */}
              {intel && recommendationHeld && (
                <div
                  className="bg-white/[0.06] border border-white/[0.12] rounded-lg p-5 space-y-3"
                  data-testid="major-event-hold-payoff-neutral"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Today&apos;s Conditions
                  </p>

                  <div className="space-y-2">
                    {currentWaveHeightLabel && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-base leading-none">🌊</span>
                        <span className="text-white">
                          {currentWaveHeightLabel}
                        </span>
                      </div>
                    )}
                    {(intel.wind_speed_mph != null ||
                      intel.wind_direction_text) && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-base leading-none">🌬️</span>
                        <span className="text-white">
                          {intel.wind_speed_mph != null
                            ? `${intel.wind_speed_mph}mph`
                            : ''}{' '}
                          {intel.wind_direction_text ?? ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Best Window Card (when allowed intel is available) */}
              {intel &&
                !recommendationHeld &&
                (intel.best_window_start || intel.surf_description) && (
                <div className="bg-white/[0.06] border border-white/[0.12] rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      Your Best Window
                    </p>
                    {conditionsScore !== null && (
                      <span className="text-sm font-bold text-[#F78E42]">
                        <AnimatedScore target={conditionsScore} />/10
                      </span>
                    )}
                  </div>

                  {intel.best_window_start && intel.best_window_end && (
                    <p className="text-white text-2xl font-bold">
                      {formatTime(intel.best_window_start)} —{' '}
                      {formatTime(intel.best_window_end)}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    {formatIntelWaveHeightLabel(intel) && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">🌊</span>
                        <span className="text-white">
                          {formatIntelWaveHeightLabel(intel)}
                        </span>
                      </div>
                    )}
                    {intel.wind_quality && intel.wind_speed_mph !== null && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">🌬️</span>
                        <span className="text-white">
                          {intel.wind_quality} {intel.wind_speed_mph}mph
                        </span>
                      </div>
                    )}
                  </div>

                  {intel.best_window_description && (
                    <p className="text-sm italic text-white/50">
                      {intel.best_window_description}
                    </p>
                  )}
                </div>
              )}

              {/* Fallback Card (when no intel, using forecastPreview) */}
              {!intel && forecastPreview && (
                <div className="bg-white/[0.06] border border-white/[0.12] rounded-lg p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Today&apos;s Conditions
                  </p>

                  <div className="space-y-2">
                    {forecastPreview.wave_height && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-base leading-none">🌊</span>
                        <span className="text-white">{forecastPreview.wave_height}</span>
                      </div>
                    )}
                    {(forecastPreview.wind_speed || forecastPreview.wind_direction) && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-base leading-none">🌬️</span>
                        <span className="text-white">
                          {forecastPreview.wind_speed}{' '}
                          {forecastPreview.wind_direction}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm italic text-white/50">
                    Full forecast available on your home page
                  </p>
                </div>
              )}

              {/* No Data State */}
              {!intel && !forecastPreview && (
                <div className="bg-white/[0.06] border border-white/[0.12] rounded-lg p-5">
                  <p className="text-sm text-white/50">
                    Your surf call is ready on the home page
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Beat 2: XP Badge — sticker slap entrance */}
          {beat >= 2 && (
            <motion.div
              initial={
                reducedMotion
                  ? false
                  : { opacity: 0, scale: 1.5, rotate: -5 }
              }
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 300,
                      damping: 15,
                      duration: 0.4,
                    }
              }
              className="relative z-10 bg-white/[0.08] border border-white/[0.15] rounded-lg p-3 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-[#F78E42]/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-[#F78E42]" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">
                  +100 XP &middot; {kookTitle}
                </p>
                <p className="text-xs text-white/50">
                  Log sessions to train your beach&apos;s forecast — every report makes it sharper
                </p>
              </div>
            </motion.div>
          )}

          {/* Beat 3: CTA Button — gradient sweep + pulse glow aura */}
          {beat >= 3 && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 0.4, ease: 'easeOut' }
              }
              className="relative z-10"
            >
              <button
                onClick={handleFinish}
                disabled={isSaving}
                className="formgrid-cta-sweep formgrid-cta-glow w-full py-3.5 rounded-lg bg-gradient-to-r from-[#F78E42] to-[#D57835] text-white font-semibold text-sm disabled:opacity-50 transition-opacity focus-ring"
                data-testid="complete-onboarding-button"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up...
                  </span>
                ) : (
                  "Let's go"
                )}
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
