'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useProfileContext } from '@/context/profile-context';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, MapPin, Waves } from 'lucide-react';
import { saveOnboardingData } from '@/actions/onboarding-actions';
import { toast } from 'sonner';
import type { Profile } from '@/types/database';

interface ForecastPreview {
  score: number;
  condition: string;
  waveHeight: string;
  wind: string;
  tide: string;
}

export function CompletionStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, completeOnboarding } = useOnboardingStore();
  const { updateProfile } = useProfileContext();
  const [isSaving, setIsSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const [forecastPreview, setForecastPreview] = useState<ForecastPreview | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);

  const isDebugOnboarding =
    searchParams?.get('debugOnboarding') === '1' &&
    process.env.NODE_ENV !== 'production';

  // Fetch forecast preview for home beach
  useEffect(() => {
    const fetchForecast = async () => {
      if (!data.homeBeachId) return;

      setLoadingForecast(true);
      try {
        const res = await fetch(`/api/beaches/${data.homeBeachId}/forecast?preview=true`);
        if (res.ok) {
          const forecastData = await res.json();
          if (forecastData && forecastData.today) {
            setForecastPreview({
              score: forecastData.today.score || 0,
              condition: forecastData.today.condition || 'Unknown',
              waveHeight: forecastData.today.waveHeight || '--',
              wind: forecastData.today.wind || '--',
              tide: forecastData.today.tide || '--',
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch forecast preview:', error);
      } finally {
        setLoadingForecast(false);
      }
    };

    fetchForecast();
  }, [data.homeBeachId]);

  // Hide confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      // Debug harness: allow local/E2E to validate close + navigation deterministically
      // without depending on the authenticated server action succeeding.
      if (isDebugOnboarding) {
        completeOnboarding();
        toast.success('Welcome to Quiver! (debug)');
        router.push('/?tab=forecast');
        router.refresh();
        return;
      }

      const result = await saveOnboardingData(data);
      if (result.success && 'profile' in result && result.profile) {
        updateProfile(result.profile as Profile);

        completeOnboarding();
        toast.success('Welcome to Quiver!');

        // Notify profile context so it can refresh quickly.
        window.dispatchEvent(new CustomEvent('onboarding_completed'));

        // Deterministic destination: dashboard Forecast tab.
        router.push('/?tab=forecast');
        router.refresh();
      } else if (!result.success) {
        const errorMessage = 'error' in result ? result.error : 'Failed to save your preferences. Please try again.';
        console.error('Onboarding save failed:', errorMessage);
        toast.error(errorMessage || 'Failed to save your preferences. Please try again.');
      }
    } catch (error: unknown) {
      console.error('Failed to complete onboarding:', error);
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="text-center space-y-6 relative" data-testid="completion-step">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <Sparkles
                className="h-4 w-4"
                style={{
                  color: ['#0077B6', '#FF7F11', '#10B981', '#8B5CF6', '#EC4899'][
                    Math.floor(Math.random() * 5)
                  ],
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Celebration Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center animate-bounce-slow">
          <span className="text-4xl">🎉</span>
        </div>
      </div>

      {/* Welcome Text */}
      <div>
        <h1 className="text-3xl font-bold mb-2">You&apos;re all set!</h1>
        <p className="text-muted-foreground">
          {data.fullName
            ? `Welcome, ${data.fullName.split(' ')[0]}!`
            : 'Your personalized surf forecast is ready.'}
        </p>
      </div>

      {/* Forecast Preview Card (if home beach selected) */}
      {data.homeBeachId && data.homeBeachName && (
        <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg p-4 border border-sky-200 text-left">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-ocean-blue" />
            <span className="font-semibold text-sm">Today at {data.homeBeachName}</span>
          </div>

          {loadingForecast ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-ocean-blue" />
            </div>
          ) : forecastPreview ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Score</span>
                <span className={`font-bold ${getScoreColor(forecastPreview.score)}`}>
                  {forecastPreview.score}/100 - {forecastPreview.condition}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Waves</span>
                <span>{forecastPreview.waveHeight}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Wind</span>
                <span>{forecastPreview.wind}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Waves className="h-4 w-4" />
              <span>Forecast will be available on your home page</span>
            </div>
          )}
        </div>
      )}

      {/* XP Badge */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4 border border-green-200">
        <p className="font-bold text-lg">+100 XP earned!</p>
        <p className="text-sm text-muted-foreground">
          Welcome to the surf community
        </p>
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
            Setting up your account...
          </>
        ) : (
          'View Full Forecast'
        )}
      </Button>

      {/* CSS for confetti animation */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(300px) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
