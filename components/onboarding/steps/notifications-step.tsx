'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notificationsSchema, NotificationsFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail } from 'lucide-react';

export function NotificationsStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();

  const { handleSubmit, control } = useForm<NotificationsFormData>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      pushEnabled: data.pushEnabled || false,
      emailEnabled: data.emailEnabled !== undefined ? data.emailEnabled : true,
    },
  });

  const onSubmit = (formData: NotificationsFormData) => {
    updateData(formData);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
            <Bell className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Stay in the loop</h2>
        <p className="text-gray-600 text-sm">
          Get notified about ideal surf conditions and community updates
        </p>
      </div>

      <div className="space-y-4">
        {/* Push Notifications */}
        <Controller
          name="pushEnabled"
          control={control}
          render={({ field }) => (
            <div className="flex items-start justify-between p-4 border-2 rounded-lg">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bell className="h-5 w-5 text-ocean-blue" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="pushEnabled" className="font-semibold cursor-pointer">
                    Push Notifications
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Get alerts for great surf conditions at your home beach
                  </p>
                </div>
              </div>
              <Switch
                id="pushEnabled"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />

        {/* Email Notifications */}
        <Controller
          name="emailEnabled"
          control={control}
          render={({ field }) => (
            <div className="flex items-start justify-between p-4 border-2 rounded-lg">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="emailEnabled" className="font-semibold cursor-pointer">
                    Email Updates
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Weekly surf reports and community highlights
                  </p>
                </div>
              </div>
              <Switch
                id="emailEnabled"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs text-gray-600">
          You can change these preferences anytime from your account settings.
          We respect your privacy and won&apos;t spam you.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1">
          Continue
        </Button>
      </div>
    </form>
  );
}
