'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useProfileContext } from '@/context/profile-context';
import { useForecastPreview } from '@/hooks/use-forecast-preview';
import { saveOnboardingData } from '@/actions/onboarding-actions';
import { data as dataClient } from '@/lib/data/client';
import { getLocalDateString } from '@/lib/utils/timezone-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, MapPin, Sparkles, Waves, Wind } from 'lucide-react';
import { toast } from 'sonner';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { LEVEL_THRESHOLDS } from '@/lib/gamification/constants';
import type { Profile } from '@/types/database';
import type { ClientBeachDailyIntel } from '@/lib/data/client';

// Animated score counter — displays a spring-animated number
function AnimatedScore({ target }: { target: number }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 80, damping: 20 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionValue.set(target);
    const unsubscribe = springValue.on('change', (v) => {
      setDisplay(Math.round(v));
    });
    return unsubscribe;
  }, [target, motionValue, springValue]);

  return <span>{display}</span>;
}

export function PayoffStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, completeOnboarding } = useOnboardingStore();
  const { updateProfile } = useProfileContext();
  const reducedMotion = useReducedMotion();

  const [isSaving, setIsSaving] = useState(true);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
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

  // Shared save logic — returns true on success
  const attemptSave = async (): Promise<boolean> => {
    try {
      const result = await saveOnboardingData(data);

      if (!result.success) {
        toast.error(result.error || 'Failed to save your preferences. Please try again.');
        return false;
      }

      if (!result.data?.success) {
        toast.error(result.data?.error || 'Failed to save your preferences. Please try again.');
        return false;
      }

      if (result.data.profile) {
        updateProfile(result.data.profile as Profile);
      }

      setSaveSucceeded(true);
      return true;
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
      toast.error('Failed to save your preferences. Please try again.');
      return false;
    }
  };

  // On mount: save onboarding data and fetch daily intel
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function saveAndFetch() {
      // Debug mode: skip save
      if (isDebugOnboarding) {
        setIsSaving(false);
        setSaveSucceeded(true);
        setIntelLoading(false);
        return;
      }

      const saved = await attemptSave();
      setIsSaving(false);

      // Fetch daily intel regardless of save outcome
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

    saveAndFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = isSaving || intelLoading || forecastLoading;

  // Start reveal beats once content is loaded
  useEffect(() => {
    if (isLoading) return;

    if (reducedMotion) {
      // Show everything immediately
      setBeat(2);
      return;
    }

    // Beat 1: immediate — beach name + conditions card
    setBeat(1);

    // Beat 2: 500ms — XP badge + confetti
    const t2 = setTimeout(() => {
      setBeat(2);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#F78E42', '#FFB703', '#FFFFFF', '#00B4D8', '#FF6B6B'],
      });
    }, 500);

    return () => {
      clearTimeout(t2);
    };
  }, [isLoading, reducedMotion]);

  const handleFinish = async () => {
    // If save hasn't succeeded yet, retry
    if (!saveSucceeded && !isDebugOnboarding) {
      setIsSaving(true);
      const saved = await attemptSave();
      setIsSaving(false);
      if (!saved) return;
    }

    // Complete onboarding
    completeOnboarding();

    // Dispatch completion event
    window.dispatchEvent(new CustomEvent('onboarding_completed'));

    // Navigate to home with forecast tab
    router.push('/?tab=forecast');
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
  const kookTitle = LEVEL_THRESHOLDS[0].title;

  return (
    <div className="space-y-6" data-testid="payoff-step">
      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 bg-white/10" />
          <Skeleton className="h-32 w-full bg-white/10" />
          <Skeleton className="h-16 w-full bg-white/10" />
        </div>
      ) : (
        <>
          {/* Beat 1: Heading + Conditions Card */}
          {beat >= 1 && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#F78E42]" />
                <h2 className="text-white font-heading text-2xl font-bold">
                  You&apos;re set up for {data.homeBeachName || 'your home beach'}
                </h2>
              </div>

              {/* Best Window Card (when intel is available) */}
              {intel && (intel.best_window_start || intel.surf_description) && (
                <div className="bg-white/10 border border-white/20 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-medium">
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
                    {intel.surf_min_ft !== null && intel.surf_max_ft !== null && (
                      <div className="flex items-center gap-1">
                        <Waves className="h-4 w-4 text-medium" />
                        <span className="text-white">
                          {intel.surf_min_ft}-{intel.surf_max_ft} ft
                        </span>
                      </div>
                    )}
                    {intel.wind_quality && intel.wind_speed_mph !== null && (
                      <div className="flex items-center gap-1">
                        <Wind className="h-4 w-4 text-medium" />
                        <span className="text-white">
                          {intel.wind_quality} {intel.wind_speed_mph}mph
                        </span>
                      </div>
                    )}
                  </div>

                  {intel.best_window_description && (
                    <p className="text-sm italic text-medium">
                      {intel.best_window_description}
                    </p>
                  )}
                </div>
              )}

              {/* Fallback Card (when no intel, using forecastPreview) */}
              {!intel && forecastPreview && (
                <div className="bg-white/10 border border-white/20 rounded-lg p-6 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-medium">
                    Today&apos;s Conditions
                  </p>

                  <div className="space-y-2">
                    {forecastPreview.wave_height && (
                      <div className="flex items-center gap-2 text-sm">
                        <Waves className="h-4 w-4 text-medium" />
                        <span className="text-white">{forecastPreview.wave_height}</span>
                      </div>
                    )}
                    {(forecastPreview.wind_speed || forecastPreview.wind_direction) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Wind className="h-4 w-4 text-medium" />
                        <span className="text-white">
                          {forecastPreview.wind_speed}{' '}
                          {forecastPreview.wind_direction}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm italic text-medium">
                    Full forecast available on your home page
                  </p>
                </div>
              )}

              {/* No Data State */}
              {!intel && !forecastPreview && (
                <div className="bg-white/10 border border-white/20 rounded-lg p-6">
                  <p className="text-sm text-medium">
                    Your personalized forecast is ready on the home page
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Beat 2: XP Badge + CTA */}
          {beat >= 2 && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 300, damping: 18 }
              }
              className="space-y-4"
            >
              {/* XP Badge */}
              <div className="bg-white/10 border border-white/20 rounded-lg p-3 flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[#F78E42]" />
                <div>
                  <p className="font-bold text-sm text-white">
                    +100 XP &middot; {kookTitle}
                  </p>
                  <p className="text-xs text-medium">
                    Welcome to the surf community
                  </p>
                </div>
              </div>

              {/* CTA Button */}
              <motion.button
                onClick={handleFinish}
                disabled={isSaving}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reducedMotion ? 0 : 0.2, duration: 0.3 }}
                className="w-full py-3.5 rounded-lg bg-gradient-to-r from-[#F78E42] to-[#D57835] text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
                data-testid="complete-onboarding-button"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up...
                  </span>
                ) : (
                  'See your full forecast \u2192'
                )}
              </motion.button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
