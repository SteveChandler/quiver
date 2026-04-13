/**
 * PreferencesDisplayCard Component
 *
 * Read-only display of user surf preferences on the profile page.
 * Shows:
 * - Experience Level (with emoji)
 * - Surf Styles (as emoji badges, multiple values)
 *
 * Features:
 * - Graceful null/empty state handling
 * - Optional edit button (via onEdit callback)
 * - Responsive grid layout
 * - Matches Quiver design patterns
 *
 * @example
 * ```tsx
 * <PreferencesDisplayCard
 *   profile={profileData}
 *   onEdit={() => router.push('/profile/preferences')}
 * />
 * ```
 */

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Edit2 } from 'lucide-react';
import type { Profile } from '@/types/database';
import {
  EXPERIENCE_LEVELS,
  SURF_STYLES,
} from '@/lib/constants/user-preferences';

interface PreferencesDisplayCardProps {
  profile: Profile;
  onEdit?: () => void;
}

export function PreferencesDisplayCard({
  profile,
  onEdit,
}: PreferencesDisplayCardProps) {
  // Helper functions to find preference data
  const getExperienceLevel = () => {
    if (!profile.experience_level) return null;
    return EXPERIENCE_LEVELS.find((level) => level.value === profile.experience_level);
  };

  const getSurfStyles = () => {
    if (!profile.surf_styles || profile.surf_styles.length === 0) return null;
    return profile.surf_styles
      .map((styleValue) => SURF_STYLES.find((style) => style.value === styleValue))
      .filter((style): style is NonNullable<typeof style> => style !== null && style !== undefined);
  };

  const experienceLevel = getExperienceLevel();
  const surfStyles = getSurfStyles();

  // Check if any preferences are set
  const hasAnyPreferences = experienceLevel || surfStyles;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Surf Preferences</CardTitle>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0"
              aria-label="Edit preferences"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasAnyPreferences ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              No preferences set yet. {onEdit && 'Click the edit button to add your preferences.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Experience Level */}
            {experienceLevel && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  Experience Level
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{experienceLevel.emoji}</span>
                  <span className="text-base text-gray-700">
                    {experienceLevel.label}
                  </span>
                </div>
              </div>
            )}

            {/* Surf Styles */}
            {surfStyles && surfStyles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  Surf Styles
                </h4>
                <div className="flex flex-wrap gap-2">
                  {surfStyles.map((style) => (
                    <Badge
                      key={style.value}
                      variant="secondary"
                      className="text-sm px-3 py-1"
                    >
                      <span className="mr-1.5">{style.emoji}</span>
                      {style.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
