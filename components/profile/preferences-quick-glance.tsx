"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  EXPERIENCE_LEVELS,
  SURF_STYLES,
} from "@/lib/constants/user-preferences";
import type { ProfilePageProfile, ProfilePagePreferences } from "@/types/profile-page";

interface PreferencesQuickGlanceProps {
  profile: ProfilePageProfile;
  preferences: ProfilePagePreferences;
}

/**
 * PreferencesQuickGlance - Compact horizontal badge row
 *
 * Shows 3 key preferences at a glance:
 * 1. Experience Level (profile.experience_level)
 * 2. Surf Styles (profile.surf_styles)
 * 3. Learned Wave Range (preferences.wave_min_ft/wave_max_ft)
 *
 * Uses muted styling for unset values.
 * "Edit" button navigates to surf-profile tab.
 */
export function PreferencesQuickGlance({
  profile,
  preferences,
}: PreferencesQuickGlanceProps) {
  const router = useRouter();

  // Memoize badges to avoid recalculation on every render
  const badges = useMemo(() => {
    // Helper to get label from constants
    const getExperienceLabel = (value: string | null) => {
      if (!value) return null;
      const item = EXPERIENCE_LEVELS.find((l) => l.value === value);
      return item ? `${item.emoji} ${item.label}` : value;
    };

    const getSurfStylesLabel = (styles: string[] | null) => {
      if (!styles || styles.length === 0) return null;
      const labels = styles.slice(0, 2).map((s) => {
        const item = SURF_STYLES.find((st) => st.value === s);
        return item ? item.label : s;
      });
      if (styles.length > 2) {
        return `${labels.join(", ")} +${styles.length - 2}`;
      }
      return labels.join(", ");
    };

    const getLearnedWaveRange = () => {
      const learned = preferences?.learned;
      if (!learned || typeof learned.confidence !== "number" || learned.confidence < 0.5) {
        return null;
      }
      if (learned.wave_min_ft && learned.wave_max_ft) {
        return `${learned.wave_min_ft}-${learned.wave_max_ft}ft (learned)`;
      }
      return null;
    };

    // Calculate learned wave range once
    const learnedWaveRange = getLearnedWaveRange();

    return [
      {
        label: getExperienceLabel(profile.experience_level) || "Level not set",
        isSet: !!profile.experience_level,
        category: "Experience",
      },
      {
        label: getSurfStylesLabel(profile.surf_styles) || "Style not set",
        isSet: !!(profile.surf_styles && profile.surf_styles.length > 0),
        category: "Style",
      },
      {
        label: learnedWaveRange || "Log 5+ sessions",
        isSet: !!learnedWaveRange,
        category: "Learned",
      },
    ];
  }, [profile, preferences]);

  const handleEditClick = () => {
    router.push("/profile?tab=surf-profile");
  };

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Surf preferences summary">
      {badges.map((badge) => (
        <Badge
          key={badge.category}
          variant={badge.isSet ? "secondary" : "outline"}
          aria-label={`${badge.category}: ${badge.label}`}
          className={
            badge.isSet
              ? "bg-ocean-blue/10 text-ocean-blue border-ocean-blue/20 hover:bg-ocean-blue/20"
              : "text-muted-foreground border-dashed"
          }
        >
          {badge.label}
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleEditClick}
        aria-label="Edit surf preferences"
        className="h-6 px-2 text-xs text-ocean-blue hover:text-ocean-blue/80 hover:bg-ocean-blue/10"
      >
        <Edit className="h-3 w-3 mr-1" />
        Edit
      </Button>
    </div>
  );
}
