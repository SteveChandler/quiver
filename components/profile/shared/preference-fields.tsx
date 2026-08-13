"use client";

import { Controller, Control } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_LEVELS,
  SURF_STYLES,
} from "@/lib/constants/user-preferences";

/**
 * Reusable preference field components for surf profile preferences
 * Extracted from ProfilePreferences to enable reuse in EditProfileForm
 * All components are React Hook Form compatible using Controller
 */

// Base interfaces for field props
interface BaseFieldProps {
  control: Control<any>;
  name: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Experience Level Field - Dropdown with emoji + label + description
 */
export interface ExperienceLevelFieldProps extends BaseFieldProps {
  label?: string;
  description?: string;
}

export function ExperienceLevelField({
  control,
  name,
  error,
  disabled = false,
  label = "Experience Level",
  description = "How experienced are you with surfing?",
}: ExperienceLevelFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
          <select
            id={name}
            value={field.value || ""}
            onChange={(e) => field.onChange(e.target.value || null)}
            className={cn(
              "w-full px-3 py-2 border rounded-md",
              "hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error ? "border-red-500" : "border-gray-300"
            )}
            disabled={disabled}
          >
            <option value="">Select your experience level</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.emoji} {level.label} - {level.description}
              </option>
            ))}
          </select>
          {description && !error && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    />
  );
}

/**
 * Surf Styles Field - Multi-select with emoji buttons
 */
export interface SurfStylesFieldProps extends BaseFieldProps {
  label?: string;
  description?: string;
}

export function SurfStylesField({
  control,
  name,
  error,
  disabled = false,
  label = "Surf Styles (select all that apply)",
  description,
}: SurfStylesFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2">
          <Label>{label}</Label>
          <div className="grid grid-cols-3 gap-3">
            {SURF_STYLES.map((style) => {
              const isSelected = field.value?.includes(style.value) ?? false;
              return (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    const current = field.value || [];
                    const updated = isSelected
                      ? current.filter((v: string) => v !== style.value)
                      : [...current, style.value];
                    field.onChange(updated);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  ) + " focus-ring"}
                  disabled={disabled}
                >
                  <span className="text-2xl">{style.emoji}</span>
                  <div className="font-medium text-xs">{style.label}</div>
                </button>
              );
            })}
          </div>
          {description && !error && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    />
  );
}
