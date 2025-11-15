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
 * Error categories
 */
export type ErrorCategory =
  | 'network'
  | 'data_parsing'
  | 'rendering'
  | 'user_input'
  | 'system'
  | 'unknown';

/**
 * Retry strategies
 */
export type RetryStrategy = 'exponential' | 'linear' | 'fixed';

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
