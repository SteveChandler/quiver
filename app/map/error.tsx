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
      route: 'map',
    });
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      resetError={reset}
      title="Map Error"
      description="We couldn't load the map. Please check your connection and try again."
    />
  );
}
