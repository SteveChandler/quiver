// Core boundaries
export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';

export { DataErrorBoundary } from './DataErrorBoundary';
export type { DataErrorBoundaryProps } from './DataErrorBoundary';

export { FormErrorBoundary } from './FormErrorBoundary';
export type { FormErrorBoundaryProps } from './FormErrorBoundary';

// Fallback UI
export { ErrorFallback } from './ErrorFallback';
export type { ErrorFallbackProps } from './ErrorFallback';

export { NetworkErrorFallback } from './NetworkErrorFallback';
export type { NetworkErrorFallbackProps } from './NetworkErrorFallback';

export { DataLoadErrorFallback } from './DataLoadErrorFallback';
export type { DataLoadErrorFallbackProps } from './DataLoadErrorFallback';

// Utilities
export { retryWithBackoff } from './utils/retry-strategies';
export type { RetryStrategy } from './utils/retry-strategies';

export { categorizeError } from './utils/error-categorizer';
export type { ErrorCategory } from './utils/error-categorizer';

export {
  saveFormState,
  loadFormState,
  clearFormState,
} from './utils/state-persistence';

export { logErrorBoundary } from './utils/error-logger';
export type { ErrorLogContext } from './utils/error-logger';

// Types
export type {
  ErrorBoundaryTier,
  ErrorBoundaryType,
  BaseErrorBoundaryProps,
  ErrorFallbackRender,
  ErrorHandler,
} from './types';
