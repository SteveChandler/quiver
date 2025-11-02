'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ProfileStep() {
  const { data, updateData, nextStep } = useOnboardingStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: data.fullName || '',
      displayName: data.displayName || '',
    },
    mode: 'onChange',
  });

  const onSubmit = (formData: ProfileFormData) => {
    updateData(formData);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">What&apos;s your name?</h2>
        <p className="text-gray-600 text-sm">
          Let the community know who you are
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            placeholder="e.g., Sarah Johnson"
            {...register('fullName')}
            aria-invalid={!!errors.fullName}
          />
          {errors.fullName && (
            <p className="text-sm text-red-600 mt-1" role="alert">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            placeholder="e.g., WaveRider"
            {...register('displayName')}
            aria-invalid={!!errors.displayName}
          />
          <p className="text-xs text-gray-500 mt-1">
            This is how you&apos;ll appear to other surfers
          </p>
          {errors.displayName && (
            <p className="text-sm text-red-600 mt-1" role="alert">
              {errors.displayName.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!isValid}>
        Continue
      </Button>
    </form>
  );
}
