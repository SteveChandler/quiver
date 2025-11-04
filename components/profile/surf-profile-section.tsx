'use client';

import { useCallback, useState } from 'react';
import { useDataFetcher } from '@/hooks/use-data-fetcher';
import { getUserLearnedPreferences, validateUserPreferences, updateUserSurfPreferences } from '@/actions/preference-actions';
import { LearnedPreferencesDisplay } from './learned-preferences-display';
import { ValidationPrompt } from './validation-prompt';
import { PreferenceOverrideForm } from './preference-override-form';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Waves } from 'lucide-react';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';

/**
 * SurfProfileSection - Main container for the "Your Surf Profile" feature
 *
 * Manages the full workflow:
 * 1. Fetches learned + onboarding preferences
 * 2. Shows validation prompt (if unvalidated)
 * 3. Displays learned preferences
 * 4. Handles edit mode (override form)
 *
 * States:
 * - Loading: Skeleton loader
 * - No data: Friendly message encouraging sessions
 * - Unvalidated: Prompt + Display
 * - Validated: Display + Edit button
 * - Edit mode: Override form
 *
 * @example
 * ```tsx
 * <TabsContent value="surf-profile">
 *   <Suspense fallback={<LoadingSkeleton />}>
 *     <SurfProfileSection />
 *   </Suspense>
 * </TabsContent>
 * ```
 */
export function SurfProfileSection() {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Fetch preferences with useDataFetcher pattern
  const fetchPreferences = useCallback(async () => {
    return await getUserLearnedPreferences();
  }, []);

  const { data, loading, error, refetch } = useDataFetcher(fetchPreferences);

  // Handle validation confirmation
  const handleValidate = async () => {
    try {
      await validateUserPreferences(true);
      await refetch();
    } catch (err) {
      console.error('Failed to validate preferences:', err);
    }
  };

  // Handle edit mode
  const handleEdit = () => {
    setMode('edit');
  };

  // Handle save overrides
  const handleSave = async (overrides: Partial<UserSurfPreferences>) => {
    await updateUserSurfPreferences(overrides);
    setMode('view');
    await refetch();
  };

  // Handle cancel
  const handleCancel = () => {
    setMode('view');
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-blue" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state (< 5 rated sessions)
  if (!data?.learned) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waves className="h-5 w-5 text-ocean-blue" />
            Your Surf Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 space-y-4">
          <div className="text-6xl mb-4">🏄‍♂️</div>
          <h3 className="text-lg font-semibold">Not enough data yet</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Log at least 5 surf sessions with ratings to see your learned preferences.
            We'll analyze your sessions to understand what conditions you love!
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6 max-w-md mx-auto">
            <p className="text-sm text-gray-700">
              💡 <strong>Tip:</strong> Rate your sessions to help us learn your preferences faster.
              The more sessions you log, the better we understand your ideal conditions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  if (mode === 'edit') {
    return (
      <PreferenceOverrideForm
        currentPreferences={data.learned}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  // View mode
  const isValidated = !!data.learned.validated_at;

  return (
    <div className="space-y-6">
      {/* Validation Prompt (only if not validated) */}
      {!isValidated && (
        <ValidationPrompt
          onValidate={handleValidate}
          onEdit={handleEdit}
          sampleSize={data.learned.sample_size}
        />
      )}

      {/* Learned Preferences Display */}
      <LearnedPreferencesDisplay preferences={data.learned} />

      {/* Edit Button */}
      <div className="flex justify-center pt-4">
        <Button onClick={handleEdit} variant="outline" className="w-full sm:w-auto">
          Edit Preferences
        </Button>
      </div>

      {/* Additional Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
        <p>
          <strong>How it works:</strong> We analyze your highly-rated sessions (3+ stars)
          to learn your ideal wave height, period, wind, and tide conditions.
          {data.learned.sample_size && ` Based on ${data.learned.sample_size} sessions.`}
        </p>
      </div>
    </div>
  );
}
