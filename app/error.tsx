"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/error-boundaries";
import { logErrorBoundary } from "@/components/error-boundaries";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logErrorBoundary(error, {
      tier: "tier_1",
      boundaryType: "global",
      route: "root",
    });
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      resetError={reset}
      title="Application Error"
      description="An unexpected error occurred in the application. Please try refreshing the page."
    />
  );
}
