"use client";

import { useCallback, useState, useEffect } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  getUserLearnedPreferences,
  validateUserPreferences,
  updateUserSurfPreferences,
} from "@/actions/preference-actions";
import { LearnedPreferencesDisplay } from "./learned-preferences-display";
import { ValidationPrompt } from "./validation-prompt";
import { PreferenceOverrideForm } from "./preference-override-form";
import { ProfilePreferences } from "./profile-preferences";
import { PreferencesDisplayCard } from "./preferences-display-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Waves, Settings } from "lucide-react";
import type { UserSurfPreferences } from "@/lib/services/preference-learning-service";
import { useAuth } from "@/context/auth-context";
import { data as gateway } from "@/lib/data/client";
import { getBeaches } from "@/actions/beach-actions";
import type { Beach, Profile } from "@/types/database";
import { useScrollToElement } from "@/hooks/use-scroll-to-element";

/**
 * SurfProfileSection - Main container for the "Your Surf Profile" feature
 *
 * Manages the full workflow:
 * 1. Fetches learned + onboarding preferences
 * 2. Shows explicit preference editing (ProfilePreferences)
 * 3. Shows validation prompt (if unvalidated)
 * 4. Displays learned preferences
 * 5. Handles edit mode (override form)
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
  const { user } = useAuth();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [isEditingExplicit, setIsEditingExplicit] = useState(false); // Toggle for explicit preferences edit
  const [shouldScrollToEdit, setShouldScrollToEdit] = useState(false);
  const editFormRef = useScrollToElement<HTMLDivElement>({
    shouldScroll: shouldScrollToEdit,
  });

  // Fetch profile and beaches data
  const fetchProfileData = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");

    const profileData = await gateway.users.profile.get(user.id);
    setProfile(profileData as Profile);

    const beachesResult = await getBeaches();
    const beachesData =
      beachesResult.success && beachesResult.data ? beachesResult.data : [];
    setBeaches(beachesData);

    return { profile: profileData, beaches: beachesData };
  }, [user]);

  const { loading: profileLoading } = useDataFetcher(fetchProfileData, {
    immediate: true,
    skip: !user,
  });

  // Fetch preferences with useDataFetcher pattern
  const fetchPreferences = useCallback(async () => {
    return await getUserLearnedPreferences();
  }, []);

  const {
    data,
    loading: prefsLoading,
    error,
    refetch,
  } = useDataFetcher(fetchPreferences);

  const loading = profileLoading || prefsLoading;

  // Handle validation confirmation
  const handleValidate = async () => {
    try {
      await validateUserPreferences(true);
      await refetch();
    } catch (err) {
      console.error("Failed to validate preferences:", err);
    }
  };

  // Handle edit mode
  const handleEdit = () => {
    setMode("edit");
  };

  // Handle save overrides
  const handleSave = async (overrides: Partial<UserSurfPreferences>) => {
    await updateUserSurfPreferences(overrides);
    setMode("view");
    await refetch();
  };

  // Handle cancel
  const handleCancel = () => {
    setMode("view");
  };

  // Handle edit button click from display card - toggle to edit mode
  const handleEditClick = () => {
    setIsEditingExplicit(true);
    setShouldScrollToEdit(true);
  };

  // Reset scroll flag when editing ends
  useEffect(() => {
    if (!isEditingExplicit) {
      setShouldScrollToEdit(false);
    }
  }, [isEditingExplicit]);

  // Handle save complete from edit form
  const handleEditComplete = async () => {
    setIsEditingExplicit(false);
    // Refresh profile data
    await fetchProfileData();
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

  // Extract preferences data from server action response
  const preferencesData = data?.data;

  // No data state (< 5 rated sessions) - Still show explicit preferences
  if (!preferencesData?.learned) {
    return (
      <div className="space-y-8">
        {/* Explicit Preferences - Toggle between display and edit */}
        {user && profile && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5 text-ocean-blue" />
              <h2 className="text-lg font-semibold text-dark-grey">
                Your Preferences
              </h2>
            </div>

            {!isEditingExplicit ? (
              /* Display Card - Read-only view */
              <div className="mb-6">
                <PreferencesDisplayCard
                  profile={profile}
                  onEdit={handleEditClick}
                />
              </div>
            ) : (
              /* Editable Form - Only shown when editing */
              <div
                ref={editFormRef}
                className="transition-none duration-300 rounded-lg space-y-4"
              >
                <ProfilePreferences
                  userId={user.id}
                  profile={profile}
                  beaches={beaches}
                  onSaveComplete={handleEditComplete}
                />
                <Button
                  variant="outline"
                  onClick={() => setIsEditingExplicit(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Learned Preferences - Not enough data yet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-ocean-blue" />
              Learned from Your Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8 space-y-4">
            <div className="text-6xl mb-4">🏄‍♂️</div>
            <h3 className="text-lg font-semibold">Not enough data yet</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Log at least 5 surf sessions with ratings to see your learned
              preferences. We&apos;ll analyze your sessions to understand what
              conditions you love!
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6 max-w-md mx-auto">
              <p className="text-sm text-gray-700">
                💡 <strong>Tip:</strong> Rate your sessions to help us learn
                your preferences faster. The more sessions you log, the better
                we understand your ideal conditions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Edit mode
  if (mode === "edit") {
    return (
      <PreferenceOverrideForm
        currentPreferences={preferencesData.learned}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  // View mode
  const isValidated = !!preferencesData.learned.validated_at;

  return (
    <div className="space-y-8">
      {/* Explicit Preferences Section - Toggle between display and edit */}
      {user && profile && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-ocean-blue" />
            <h2 className="text-lg font-semibold text-dark-grey">
              Your Preferences
            </h2>
          </div>

          {!isEditingExplicit ? (
            /* Display Card - Read-only view */
            <div className="mb-6">
              <PreferencesDisplayCard
                profile={profile}
                onEdit={handleEditClick}
              />
            </div>
          ) : (
            /* Editable Form - Only shown when editing */
            <div
              ref={editFormRef}
              className="transition-none duration-300 rounded-lg space-y-4"
            >
              <ProfilePreferences
                userId={user.id}
                profile={profile}
                beaches={beaches}
                onSaveComplete={handleEditComplete}
              />
              <Button
                variant="outline"
                onClick={() => setIsEditingExplicit(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">
            Learned from Sessions
          </span>
        </div>
      </div>

      {/* Learned Preferences Section */}
      <div className="space-y-6">
        {/* Validation Prompt (only if not validated) */}
        {!isValidated && (
          <ValidationPrompt
            onValidate={handleValidate}
            onEdit={handleEdit}
            sampleSize={preferencesData.learned.sample_size}
          />
        )}

        {/* Learned Preferences Display */}
        <LearnedPreferencesDisplay preferences={preferencesData.learned} />

        {/* Edit Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleEdit}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Edit Learned Preferences
          </Button>
        </div>

        {/* Additional Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
          <p>
            <strong>How it works:</strong> We analyze your highly-rated sessions
            (3+ stars) to learn your ideal wave height, period, wind, and tide
            conditions.
            {preferencesData.learned.sample_size &&
              ` Based on ${preferencesData.learned.sample_size} sessions.`}
          </p>
        </div>
      </div>
    </div>
  );
}
