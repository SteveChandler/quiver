'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useProfileContext } from '@/context/profile-context';
import { useForecastPreview } from '@/hooks/use-forecast-preview';
import { saveOnboardingData } from '@/actions/onboarding-actions';
import { data as dataClient } from '@/lib/data/client';
import { getLocalDateString } from '@/lib/utils/timezone-utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, MapPin, Sparkles, Waves, Wind } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile } from '@/types/database';
import type { ClientBeachDailyIntel } from '@/lib/data/client';

export function PayoffStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, completeOnboarding } = useOnboardingStore();
  const { updateProfile } = useProfileContext();

  const [isSaving, setIsSaving] = useState(true);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [intel, setIntel] = useState<ClientBeachDailyIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);

  const isDebugOnboarding =
    searchParams?.get('debugOnboarding') === '1' &&
    process.env.NODE_ENV !== 'production';

  // Fallback to forecast preview if no intel
  const { forecastPreview, loading: forecastLoading } = useForecastPreview({
    enabled: !intel && !intelLoading && !!data.homeBeachId,
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

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-600';
    if (score >= 7) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const isLoading = isSaving || intelLoading || forecastLoading;

  return (
    <div className="space-y-6" data-testid="payoff-step">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-5 w-5 text-ocean-blue" />
        <h2 className="text-xl font-bold">
          {data.homeBeachName || 'Your Home Beach'}
        </h2>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          {/* Best Window Card (when intel is available) */}
          {intel && (intel.best_window_start || intel.surf_description) && (
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your Best Window
                </p>
                {intel.conditions_score !== null && (
                  <span
                    className={`text-sm font-bold ${getScoreColor(intel.conditions_score)}`}
                  >
                    {intel.conditions_score}/10
                  </span>
                )}
              </div>

              {intel.best_window_start && intel.best_window_end && (
                <p className="text-2xl font-bold">
                  {formatTime(intel.best_window_start)} —{' '}
                  {formatTime(intel.best_window_end)}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm">
                {intel.surf_min_ft !== null && intel.surf_max_ft !== null && (
                  <div className="flex items-center gap-1">
                    <Waves className="h-4 w-4 text-ocean-blue" />
                    <span>
                      {intel.surf_min_ft}-{intel.surf_max_ft} ft
                    </span>
                  </div>
                )}
                {intel.wind_quality && intel.wind_speed_mph !== null && (
                  <div className="flex items-center gap-1">
                    <Wind className="h-4 w-4 text-sky-600" />
                    <span>
                      {intel.wind_quality} {intel.wind_speed_mph}mph
                    </span>
                  </div>
                )}
              </div>

              {intel.best_window_description && (
                <p className="text-sm italic text-muted-foreground">
                  {intel.best_window_description}
                </p>
              )}
            </div>
          )}

          {/* Fallback Card (when no intel, using forecastPreview) */}
          {!intel && forecastPreview && (
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-lg p-6 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Today&apos;s Conditions
              </p>

              <div className="space-y-2">
                {forecastPreview.wave_height && (
                  <div className="flex items-center gap-2 text-sm">
                    <Waves className="h-4 w-4 text-ocean-blue" />
                    <span>{forecastPreview.wave_height}</span>
                  </div>
                )}
                {(forecastPreview.wind_speed || forecastPreview.wind_direction) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Wind className="h-4 w-4 text-sky-600" />
                    <span>
                      {forecastPreview.wind_speed}{' '}
                      {forecastPreview.wind_direction}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-sm italic text-muted-foreground">
                Full forecast available on your home page
              </p>
            </div>
          )}

          {/* No Data State */}
          {!intel && !forecastPreview && (
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-lg p-6">
              <p className="text-sm text-muted-foreground">
                Your personalized forecast is ready on the home page
              </p>
            </div>
          )}

          {/* XP Badge */}
          <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-3 border border-green-200 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-bold text-sm">+100 XP earned!</p>
              <p className="text-xs text-muted-foreground">
                Welcome to the surf community
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleFinish}
            size="lg"
            className="w-full"
            disabled={isSaving}
            data-testid="complete-onboarding-button"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              'Check Full Forecast'
            )}
          </Button>
        </>
      )}
    </div>
  );
}
