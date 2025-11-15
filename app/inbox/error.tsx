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
      route: 'inbox',
    });
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      resetError={reset}
      title="Inbox Error"
      description="We couldn't load your inbox. Please try again."
    />
  );
}
