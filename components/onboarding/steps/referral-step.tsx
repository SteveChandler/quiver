'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { referralSchema, ReferralFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, Gift } from 'lucide-react';

export function ReferralStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | null>(null);

  const {
    register,
    handleSubmit,
    watch,
  } = useForm<ReferralFormData>({
    resolver: zodResolver(referralSchema),
    defaultValues: {
      referralCode: data.referralCode || '',
    },
  });

  const referralCode = watch('referralCode');

  const validateReferralCode = async (code: string) => {
    if (!code || code.trim().length === 0) {
      setValidationStatus(null);
      return;
    }

    setValidating(true);
    try {
      const res = await fetch(`/api/referrals/validate?code=${encodeURIComponent(code)}`);
      const result = await res.json();
      setValidationStatus(result.valid ? 'valid' : 'invalid');
    } catch (error) {
      console.error('Failed to validate referral code:', error);
      setValidationStatus('invalid');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (referralCode) validateReferralCode(referralCode);
    }, 500);
    return () => clearTimeout(timer);
  }, [referralCode]);

  const onSubmit = (formData: ReferralFormData) => {
    updateData(formData);
    nextStep();
  };

  const handleSkip = () => {
    updateData({ referralCode: undefined });
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <Gift className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Were you invited by a friend?</h2>
        <p className="text-gray-600 text-sm">
          Enter their referral code to unlock bonus XP for both of you!
        </p>
      </div>

      <div>
        <Label htmlFor="referralCode">Referral Code (Optional)</Label>
        <div className="relative">
          <Input
            id="referralCode"
            {...register('referralCode')}
            placeholder="SURF2024"
            className="text-center text-lg font-mono uppercase"
            maxLength={10}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
              register('referralCode').onChange(e);
            }}
          />
          {validating && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
          {!validating && validationStatus === 'valid' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          )}
          {!validating && validationStatus === 'invalid' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
          )}
        </div>
        {validationStatus === 'valid' && (
          <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Valid code! You&apos;ll both get bonus XP
          </p>
        )}
        {validationStatus === 'invalid' && (
          <p className="text-sm text-red-600 mt-2 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Invalid code. Double-check with your friend!
          </p>
        )}
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
        <h4 className="font-semibold text-sm mb-2">Referral Benefits:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li className="flex items-center gap-2">
            <span className="text-purple-600">✨</span>
            +50 XP for you
          </li>
          <li className="flex items-center gap-2">
            <span className="text-purple-600">✨</span>
            +50 XP for your friend
          </li>
          <li className="flex items-center gap-2">
            <span className="text-purple-600">✨</span>
            Help build the surf community
          </li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          Back
        </Button>
        <Button type="button" variant="outline" onClick={handleSkip} className="flex-1">
          Skip
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={referralCode ? validationStatus !== 'valid' : false}
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
