'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { preferencesSchema, PreferencesFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  EXPERIENCE_LEVELS,
  SURF_STYLES,
  WAVE_SIZES,
  BREAK_TYPES,
  CROWD_PREFERENCES,
} from '@/lib/constants/user-preferences';

export function PreferencesStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();

  const { handleSubmit, control, formState: { errors, isValid } } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    mode: 'onSubmit',
    defaultValues: {
      experienceLevel: data.experienceLevel,
      surfStyles: data.surfStyles || [],
      preferredWaveSize: data.preferredWaveSize,
      preferredBreakType: data.preferredBreakType,
      crowdPreference: data.crowdPreference,
    },
  });

  const onSubmit = (formData: PreferencesFormData) => {
    updateData(formData);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Tell us about your surfing</h2>
        <p className="text-gray-600 text-sm">
          Help us personalize your experience
        </p>
      </div>

      {/* Experience Level */}
      <div>
        <Label>Experience Level</Label>
        <Controller
          name="experienceLevel"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value || null)}
              className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-ocean-blue focus:border-transparent"
            >
              <option value="">Select your experience level</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.emoji} {level.label} - {level.description}
                </option>
              ))}
            </select>
          )}
        />
        {errors.experienceLevel && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {errors.experienceLevel.message}
          </p>
        )}
      </div>

      {/* Surf Styles */}
      <div>
        <Label>Surf Styles (select all that apply)</Label>
        <Controller
          name="surfStyles"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-3 mt-2">
              {SURF_STYLES.map((style) => {
                const isSelected = field.value?.includes(style.value);
                return (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => {
                      const current = field.value || [];
                      const updated = isSelected
                        ? current.filter((v) => v !== style.value)
                        : [...current, style.value];
                      field.onChange(updated);
                    }}
                    className={cn(
                      'p-4 border-2 rounded-lg text-center transition-all',
                      isSelected
                        ? 'border-ocean-blue bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="text-3xl mb-1">{style.emoji}</div>
                    <div className="font-medium text-sm">{style.label}</div>
                  </button>
                );
              })}
            </div>
          )}
        />
        {errors.surfStyles && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {errors.surfStyles.message}
          </p>
        )}
      </div>

      {/* Preferred Wave Size (Optional) */}
      <div>
        <Label>Preferred Wave Size (optional)</Label>
        <Controller
          name="preferredWaveSize"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value || null)}
              className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-ocean-blue focus:border-transparent"
            >
              <option value="">Select preferred wave size</option>
              {WAVE_SIZES.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.emoji} {size.label} - {size.description}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Preferred Break Type (Optional) */}
      <div>
        <Label>Preferred Break Type (optional)</Label>
        <Controller
          name="preferredBreakType"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value || null)}
              className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-ocean-blue focus:border-transparent"
            >
              <option value="">Select preferred break type</option>
              {BREAK_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.emoji} {type.label} - {type.description}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Crowd Preference (Optional) */}
      <div>
        <Label>Crowd Tolerance (optional)</Label>
        <Controller
          name="crowdPreference"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value || null)}
              className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-ocean-blue focus:border-transparent"
            >
              <option value="">Select crowd preference</option>
              {CROWD_PREFERENCES.map((pref) => (
                <option key={pref.value} value={pref.value}>
                  {pref.emoji} {pref.label} - {pref.description}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Helper Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          ℹ️ These preferences are optional. We&apos;ll also learn from your surf sessions over time to personalize recommendations.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={!isValid}>
          Continue
        </Button>
      </div>
    </form>
  );
}
