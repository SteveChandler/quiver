"use client";

import { useEffect } from "react";
import { ErrorFallback } from "./ErrorFallback";
import { logErrorBoundary } from "./utils/error-logger";

type RouteError = Error & { digest?: string };
type RouteErrorProps = { error: RouteError; reset: () => void };

type RouteErrorOptions = {
  tier: "tier_1" | "tier_2";
  boundaryType: "global" | "route";
  route: string;
  title: string;
  description: string;
};

export function createRouteError({ tier, boundaryType, route, title, description }: RouteErrorOptions) {
  return function RouteError({ error, reset }: RouteErrorProps) {
    useEffect(() => {
      logErrorBoundary(error, { tier, boundaryType, route });
    }, [error]);

    return <ErrorFallback error={error} resetError={reset} title={title} description={description} />;
  };
}
