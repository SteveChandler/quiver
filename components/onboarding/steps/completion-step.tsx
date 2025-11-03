'use client';

import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Waves, Share2, Loader2 } from 'lucide-react';
import { saveOnboardingData } from '@/actions/onboarding-actions';
import { toast } from 'sonner';

export function CompletionStep() {
  const { data, completeOnboarding } = useOnboardingStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const result = await saveOnboardingData(data);
      if (result.success) {
        completeOnboarding();
        toast.success('Welcome to Quiver! 🎉');

        // Trigger product tour after a delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('onboarding_completed'));
        }, 500);
      } else {
        toast.error('Failed to save your preferences. Please try again.');
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center animate-bounce-slow">
          <Waves className="h-12 w-12 text-white" />
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-3">You&apos;re all set!</h1>
        <p className="text-gray-600 text-lg">
          {data.fullName ? `Welcome, ${data.fullName.split(' ')[0]}!` : 'Welcome to Quiver!'}
        </p>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-6 border border-green-200">
        <h3 className="font-bold text-lg mb-2">You&apos;ve earned +100 XP! 🎉</h3>
        <p className="text-sm text-gray-700">
          Your surf journey starts now. Track sessions, earn achievements, and connect with the community.
        </p>
      </div>

      {!showSharePrompt ? (
        <Button
          onClick={handleFinish}
          size="lg"
          className="w-full"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting up your account...
            </>
          ) : (
            'Start Surfing'
          )}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
            <h3 className="font-bold text-lg mb-2">Invite Friends & Earn More XP</h3>
            <p className="text-sm text-gray-700 mb-4">
              Get 50 XP for each friend who joins with your code
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // Will implement share modal in future
                toast.info('Share feature coming soon!');
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Your Referral Code
            </Button>
          </div>

          <Button
            onClick={handleFinish}
            size="lg"
            className="w-full"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up your account...
              </>
            ) : (
              'Start Surfing'
            )}
          </Button>
        </div>
      )}

      {data.homeBeachName && (
        <p className="text-sm text-gray-500">
          Your home beach: <strong>{data.homeBeachName}</strong>
        </p>
      )}
    </div>
  );
}
