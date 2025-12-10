"use client";

import { useId } from "react";
import { Control, UseFormSetValue } from "react-hook-form";
import { BeachSelector } from "@/components/BeachSelector";
import type { ProfileFormValues } from "@/lib/schemas/profile-schema";
import {
  ExperienceLevelField,
  SurfStylesField,
  PreferredWaveSizeField,
  PreferredBreakTypeField,
  CrowdPreferenceField,
} from "@/components/profile/shared/preference-fields";
import { FormInput } from "@/components/ui/form-fields";

interface SurfInfoFieldsProps {
  /** React Hook Form control object */
  control: Control<ProfileFormValues>;
  /** React Hook Form setValue function (required when showHomeBeach is true) */
  setValue?: UseFormSetValue<ProfileFormValues>;
  /** Whether to show the home beach selector */
  showHomeBeach?: boolean;
  /** Whether to show the Instagram field */
  showInstagram?: boolean;
  /** Initial home beach text value */
  homeBeachText?: string;
  /** Callback when home beach text changes */
  onHomeBeachTextChange?: (text: string) => void;
}

/**
 * Reusable surf information fields for profile forms
 * Includes: home beach, experience level, surf preferences, and Instagram
 * Extracted from edit-profile-form and basic-profile-form to reduce duplication
 */
export function SurfInfoFields({
  control,
  setValue,
  showHomeBeach = true,
  showInstagram = true,
  homeBeachText = "",
  onHomeBeachTextChange,
}: SurfInfoFieldsProps) {
  const homeBeachFieldId = useId();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Surf Information</h3>

      {showHomeBeach && setValue && (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={homeBeachFieldId}>
            Home Beach
          </label>
          <BeachSelector
            initialValue={homeBeachText}
            inputId={homeBeachFieldId}
            onBeachSelected={(beach) => {
              // If a real beach was selected, set the id; else keep text fallback
              if (beach?.id) {
                setValue("home_beach_id", beach.id);
                onHomeBeachTextChange?.(beach.name);
              } else {
                setValue("home_beach_id", null);
                onHomeBeachTextChange?.(beach?.name || "");
              }
            }}
          />
          <p className="text-sm text-muted-foreground">
            This beach will be shown on your home screen and pre-selected when
            logging sessions
          </p>
        </div>
      )}

      <ExperienceLevelField
        control={control}
        name="experience_level"
        error={undefined}
      />

      <SurfStylesField control={control} name="surf_styles" error={undefined} />

      <PreferredWaveSizeField
        control={control}
        name="preferred_wave_size"
        error={undefined}
      />

      <PreferredBreakTypeField
        control={control}
        name="preferred_break_type"
        error={undefined}
      />

      <CrowdPreferenceField
        control={control}
        name="crowd_preference"
        error={undefined}
      />

      {showInstagram && (
        <>
          <h3 className="text-sm font-medium">Social Media</h3>
          <FormInput
            control={control}
            name="instagram"
            label="Instagram"
            placeholder="@yourusername"
          />
        </>
      )}
    </div>
  );
}
