'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { WindDirectionCompass } from './wind-direction-compass';
import { useState } from 'react';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';

/**
 * Zod schema for preference override validation
 */
const preferenceOverrideSchema = z.object({
  wave_min_ft: z.number().min(0).max(20).optional(),
  wave_max_ft: z.number().min(0).max(20).optional(),
  wave_period_min_s: z.number().min(0).max(30).optional(),
  wave_period_max_s: z.number().min(0).max(30).optional(),
  max_wind_mph: z.number().min(0).max(40).optional(),
  preferred_wind_directions: z.array(z.number().min(0).max(360)).optional(),
  preferred_tide_statuses: z.array(z.enum(['rising', 'high', 'falling', 'low'])).optional(),
}).refine(
  (data) => {
    // Wave height: min must be less than max
    if (data.wave_min_ft !== undefined && data.wave_max_ft !== undefined) {
      return data.wave_min_ft < data.wave_max_ft;
    }
    return true;
  },
  {
    message: 'Minimum wave height must be less than maximum',
    path: ['wave_max_ft'],
  }
).refine(
  (data) => {
    // Wave period: min must be less than max
    if (data.wave_period_min_s !== undefined && data.wave_period_max_s !== undefined) {
      return data.wave_period_min_s < data.wave_period_max_s;
    }
    return true;
  },
  {
    message: 'Minimum wave period must be less than maximum',
    path: ['wave_period_max_s'],
  }
);

type PreferenceOverrideFormData = z.infer<typeof preferenceOverrideSchema>;

const TIDE_OPTIONS = [
  { value: 'rising', label: 'Rising' },
  { value: 'high', label: 'High' },
  { value: 'falling', label: 'Falling' },
  { value: 'low', label: 'Low' },
] as const;

export interface PreferenceOverrideFormProps {
  /**
   * Current learned preferences (provides defaults)
   */
  currentPreferences: UserSurfPreferences;
  /**
   * Called when user saves the form
   */
  onSave: (overrides: Partial<UserSurfPreferences>) => Promise<void>;
  /**
   * Called when user cancels editing
   */
  onCancel: () => void;
}

/**
 * PreferenceOverrideForm - Form for manually overriding learned surf preferences
 *
 * Features:
 * - Dual-range sliders for wave height/period
 * - Single slider for wind tolerance
 * - 8-way compass selector for wind directions
 * - Checkbox group for tide preferences
 * - Comprehensive validation with Zod
 * - React Hook Form integration
 *
 * @example
 * ```tsx
 * <PreferenceOverrideForm
 *   currentPreferences={learnedPrefs}
 *   onSave={async (overrides) => await updatePreferences(overrides)}
 *   onCancel={() => setEditMode(false)}
 * />
 * ```
 */
export function PreferenceOverrideForm({
  currentPreferences,
  onSave,
  onCancel,
}: PreferenceOverrideFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { handleSubmit, control, formState: { errors }, watch } = useForm<PreferenceOverrideFormData>({
    resolver: zodResolver(preferenceOverrideSchema),
    defaultValues: {
      wave_min_ft: currentPreferences.wave_min_ft ?? undefined,
      wave_max_ft: currentPreferences.wave_max_ft ?? undefined,
      wave_period_min_s: currentPreferences.wave_period_min_s ?? undefined,
      wave_period_max_s: currentPreferences.wave_period_max_s ?? undefined,
      max_wind_mph: currentPreferences.max_wind_mph ?? undefined,
      preferred_wind_directions: currentPreferences.preferred_wind_directions ?? undefined,
      preferred_tide_statuses: (currentPreferences.preferred_tide_statuses as ('rising' | 'high' | 'falling' | 'low')[]) ?? undefined,
    },
  });

  const waveMinFt = watch('wave_min_ft');
  const waveMaxFt = watch('wave_max_ft');
  const wavePeriodMinS = watch('wave_period_min_s');
  const wavePeriodMaxS = watch('wave_period_max_s');
  const maxWindMph = watch('max_wind_mph');

  const onSubmit = async (data: PreferenceOverrideFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" aria-label="Edit surf preferences">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Wave Height */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Wave Height</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="wave-height-slider" className="text-sm text-gray-600 mb-2 block">
              Preferred range: {waveMinFt ?? 0} - {waveMaxFt ?? 0} ft
            </Label>
            <Controller
              name="wave_min_ft"
              control={control}
              render={({ field: minField }) => (
                <Controller
                  name="wave_max_ft"
                  control={control}
                  render={({ field: maxField }) => (
                    <Slider
                      id="wave-height-slider"
                      min={0}
                      max={20}
                      step={0.5}
                      value={[minField.value ?? 0, maxField.value ?? 0]}
                      onValueChange={(values) => {
                        minField.onChange(values[0]);
                        maxField.onChange(values[1]);
                      }}
                      className="mt-2"
                      aria-label="Wave height range"
                    />
                  )}
                />
              )}
            />
            {errors.wave_max_ft && (
              <p className="text-sm text-red-600 mt-1" role="alert">
                {errors.wave_max_ft.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Wave Period */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Wave Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="wave-period-slider" className="text-sm text-gray-600 mb-2 block">
              Preferred range: {wavePeriodMinS ?? 0} - {wavePeriodMaxS ?? 0} seconds
            </Label>
            <Controller
              name="wave_period_min_s"
              control={control}
              render={({ field: minField }) => (
                <Controller
                  name="wave_period_max_s"
                  control={control}
                  render={({ field: maxField }) => (
                    <Slider
                      id="wave-period-slider"
                      min={0}
                      max={30}
                      step={1}
                      value={[minField.value ?? 0, maxField.value ?? 0]}
                      onValueChange={(values) => {
                        minField.onChange(values[0]);
                        maxField.onChange(values[1]);
                      }}
                      className="mt-2"
                      aria-label="Wave period range"
                    />
                  )}
                />
              )}
            />
            {errors.wave_period_max_s && (
              <p className="text-sm text-red-600 mt-1" role="alert">
                {errors.wave_period_max_s.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Wind Tolerance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Wind Tolerance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="wind-tolerance-slider" className="text-sm text-gray-600 mb-2 block">
              Maximum: Up to {maxWindMph ?? 0} mph
            </Label>
            <Controller
              name="max_wind_mph"
              control={control}
              render={({ field }) => (
                <Slider
                  id="wind-tolerance-slider"
                  min={0}
                  max={40}
                  step={1}
                  value={[field.value ?? 0]}
                  onValueChange={(values) => field.onChange(values[0])}
                  className="mt-2"
                  aria-label="Maximum wind speed"
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Wind Directions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferred Wind Directions</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            name="preferred_wind_directions"
            control={control}
            render={({ field }) => (
              <WindDirectionCompass
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </CardContent>
      </Card>

      {/* Tide Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferred Tides</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            name="preferred_tide_statuses"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-4">
                {TIDE_OPTIONS.map((tide) => {
                  const isChecked = field.value?.includes(tide.value) ?? false;
                  return (
                    <div key={tide.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tide-${tide.value}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          const current = field.value ?? [];
                          const updated = checked
                            ? [...current, tide.value]
                            : current.filter((v) => v !== tide.value);
                          field.onChange(updated);
                        }}
                      />
                      <Label
                        htmlFor={`tide-${tide.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {tide.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          💡 These overrides will be used to personalize your forecast recommendations and beach suggestions.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 sticky bottom-0 bg-white pt-4 pb-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </form>
  );
}
