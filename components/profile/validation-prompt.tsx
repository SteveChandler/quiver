/**
 * ValidationPrompt Component
 *
 * Displays a prompt asking users to validate their learned surf preferences.
 * Provides two actions:
 * - "Yes, looks good!" - Confirms preferences match their style
 * - "Let me adjust" - Opens edit mode for manual overrides
 *
 * Shows loading state during validation and error messages on failure.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ValidationPromptProps {
  onValidate: () => Promise<void> | void;
  onEdit: () => void;
  sampleSize: number;
  isValidating?: boolean;
  error?: string | null;
}

export default function ValidationPrompt({
  onValidate,
  onEdit,
  sampleSize,
  isValidating = false,
  error = null,
}: ValidationPromptProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleValidate = async () => {
    setIsLoading(true);
    try {
      await onValidate();
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = isValidating || isLoading;
  const sessionText = sampleSize === 1 ? 'session' : 'sessions';

  return (
    <Card className="border-ocean-blue/20 bg-blue-50/30">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          {/* Emoji Icon */}
          <div className="text-4xl">🌊</div>

          {/* Prompt Message */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Do these preferences match your surfing style?
            </h3>
            <p className="text-sm text-gray-600">
              We analyzed {sampleSize} of your {sessionText} to learn what conditions
              you prefer.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={handleValidate}
              disabled={disabled}
              variant="default"
              className="min-w-[140px]"
            >
              {isLoading || isValidating ? 'Saving...' : 'Yes, looks good!'}
            </Button>

            <Button
              onClick={onEdit}
              disabled={disabled}
              variant="outline"
              className="min-w-[140px]"
            >
              Let me adjust
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
