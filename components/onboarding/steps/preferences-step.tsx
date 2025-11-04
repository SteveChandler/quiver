'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { preferencesSchema, PreferencesFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', emoji: '🏄‍♂️', description: 'Just getting started' },
  { value: 'intermediate', label: 'Intermediate', emoji: '🌊', description: 'Catching waves regularly' },
  { value: 'advanced', label: 'Advanced', emoji: '🏆', description: 'Experienced surfer' },
  { value: 'expert', label: 'Expert', emoji: '🔥', description: 'Highly skilled' },
] as const;

const SURF_STYLES = [
  { value: 'longboard', label: 'Longboard', emoji: '🏄' },
  { value: 'shortboard', label: 'Shortboard', emoji: '🏄‍♀️' },
  { value: 'funboard', label: 'Funboard', emoji: '🏄‍♂️' },
  { value: 'bodyboard', label: 'Bodyboard', emoji: '🏊' },
  { value: 'sup', label: 'SUP', emoji: '🚣' },
  { value: 'foil', label: 'Foil', emoji: '✨' },
] as const;

const WAVE_SIZES = [
  { value: 'small', label: 'Small', emoji: '🌊', description: '1-3 feet' },
  { value: 'medium', label: 'Medium', emoji: '🌊🌊', description: '3-6 feet' },
  { value: 'large', label: 'Large', emoji: '🌊🌊🌊', description: '6+ feet' },
  { value: 'any', label: 'Any Size', emoji: '🤙', description: "I'll surf anything" },
] as const;

const BREAK_TYPES = [
  { value: 'beach', label: 'Beach Break', emoji: '🏖️', description: 'Sandy bottom' },
  { value: 'point', label: 'Point Break', emoji: '🪨', description: 'Rocky point' },
  { value: 'reef', label: 'Reef Break', emoji: '🪸', description: 'Coral or rock reef' },
  { value: 'any', label: 'Any Type', emoji: '✨', description: "I'll surf anywhere" },
] as const;

const CROWD_PREFERENCES = [
  { value: 'social', label: 'Love the crew', emoji: '👥', description: 'Enjoy surfing with others' },
  { value: 'moderate', label: 'A few people is fine', emoji: '🧘', description: 'Small crowds are okay' },
  { value: 'solitude', label: 'Prefer solitude', emoji: '🏝️', description: 'Like uncrowded spots' },
] as const;

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
            <div className="grid grid-cols-2 gap-3 mt-2">
              {EXPERIENCE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => field.onChange(level.value)}
                  className={cn(
                    'p-4 border-2 rounded-lg text-left transition-all',
                    field.value === level.value
                      ? 'border-ocean-blue bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="text-3xl mb-2">{level.emoji}</div>
                  <div className="font-medium text-sm">{level.label}</div>
                  <div className="text-xs text-gray-500">{level.description}</div>
                </button>
              ))}
            </div>
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
            <div className="grid grid-cols-2 gap-3 mt-2">
              {WAVE_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => field.onChange(size.value)}
                  className={cn(
                    'p-4 border-2 rounded-lg text-left transition-all',
                    field.value === size.value
                      ? 'border-ocean-blue bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                  aria-label={`${size.label} waves - ${size.description}`}
                >
                  <div className="text-3xl mb-2">{size.emoji}</div>
                  <div className="font-medium text-sm">{size.label}</div>
                  <div className="text-xs text-gray-500">{size.description}</div>
                </button>
              ))}
            </div>
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
            <div className="grid grid-cols-2 gap-3 mt-2">
              {BREAK_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => field.onChange(type.value)}
                  className={cn(
                    'p-4 border-2 rounded-lg text-left transition-all',
                    field.value === type.value
                      ? 'border-ocean-blue bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                  aria-label={`${type.label} - ${type.description}`}
                >
                  <div className="text-3xl mb-2">{type.emoji}</div>
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.description}</div>
                </button>
              ))}
            </div>
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
            <div className="grid grid-cols-1 gap-3 mt-2">
              {CROWD_PREFERENCES.map((pref) => (
                <button
                  key={pref.value}
                  type="button"
                  onClick={() => field.onChange(pref.value)}
                  className={cn(
                    'p-4 border-2 rounded-lg text-left transition-all',
                    field.value === pref.value
                      ? 'border-ocean-blue bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                  aria-label={`${pref.label} - ${pref.description}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{pref.emoji}</div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{pref.label}</div>
                      <div className="text-xs text-gray-500">{pref.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
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
