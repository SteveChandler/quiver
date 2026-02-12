'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/error-boundaries';
import { logErrorBoundary } from '@/components/error-boundaries';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logErrorBoundary(error, {
      tier: 'tier_2',
      boundaryType: 'route',
      route: 'beach-detail-intent',
    });
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      resetError={reset}
      title="Beach Details Error"
      description="We couldn't load the beach details. Please try again or return to the home page."
    />
  );
}
