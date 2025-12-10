"use client";

import { Control } from "react-hook-form";
import { FormInput, FormTextarea } from "@/components/ui/form-fields";
import type { ProfileFormValues } from "@/lib/schemas/profile-schema";

interface BasicInfoFieldsProps {
  /** React Hook Form control object */
  control: Control<ProfileFormValues>;
  /** Whether to show the email field */
  showEmail?: boolean;
  /** Whether to show the phone number field */
  showPhone?: boolean;
  /** Whether the fields are disabled */
  disabled?: boolean;
}

/**
 * Reusable basic information fields for profile forms
 * Includes: name, email (optional), phone (optional), bio, location
 * Extracted from edit-profile-form and basic-profile-form to reduce duplication
 */
export function BasicInfoFields({
  control,
  showEmail = false,
  showPhone = false,
  disabled = false,
}: BasicInfoFieldsProps) {
  return (
    <div className="space-y-4">
      <FormInput
        control={control}
        name="full_name"
        label="Name"
        placeholder="Your name"
        disabled={disabled}
      />

      {showEmail && (
        <FormInput
          control={control}
          name="email"
          label="Email"
          type="email"
          placeholder="Your email"
          disabled={disabled}
        />
      )}

      {showPhone && (
        <FormInput
          control={control}
          name="phone_number"
          label="Phone Number"
          type="tel"
          placeholder="Your phone number"
          disabled={disabled}
        />
      )}

      <FormTextarea
        control={control}
        name="bio"
        label="Bio"
        placeholder="Tell us about yourself and your surfing journey"
        disabled={disabled}
        rows={3}
      />

      <FormInput
        control={control}
        name="location"
        label="Location"
        placeholder="Where are you based?"
        disabled={disabled}
      />
    </div>
  );
}
