"use client";

import { useId } from "react";
import { Control, UseFormSetValue } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { BeachSelector } from "@/components/BeachSelector";
import type { ProfileFormValues } from "@/lib/schemas/profile-schema";

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
 * Includes: experience level, home beach (optional), Instagram (optional)
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

      <FormField
        control={control}
        name="experience_level"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Experience Level</FormLabel>
            <FormControl>
              <Input
                placeholder="Beginner, Intermediate, Advanced, etc."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {showInstagram && (
        <>
          <h3 className="text-sm font-medium">Social Media</h3>
          <FormField
            control={control}
            name="instagram"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instagram</FormLabel>
                <FormControl>
                  <Input placeholder="@yourusername" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </div>
  );
}
