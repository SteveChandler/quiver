'use client';

import { useEffect } from 'react';
import { ErrorFallback, logErrorBoundary } from '@/components/error-boundaries';

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
      route: 'intent-city',
    });
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      resetError={reset}
      title="City Surf Spots Error"
      description="We couldn't load surf spots for this city. Please try again or explore nearby areas."
    />
  );
}
