import { ReactNode, ErrorInfo } from 'react';

/**
 * Error boundary tiers
 */
export type ErrorBoundaryTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

/**
 * Error boundary types
 */
export type ErrorBoundaryType = 'global' | 'route' | 'feature' | 'component';

/**
 * Base error boundary props
 */
export interface BaseErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  tier?: ErrorBoundaryTier;
  boundaryType?: ErrorBoundaryType;
}

/**
 * Error fallback render function
 */
export type ErrorFallbackRender = (
  error: Error,
  reset: () => void
) => ReactNode;

/**
 * Error handler callback
 */
export type ErrorHandler = (
  error: Error,
  errorInfo: ErrorInfo
) => void;
