import * as Sentry from '@sentry/nextjs';

export interface ErrorLogContext {
  tier?: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  boundaryType?: 'global' | 'route' | 'feature' | 'component';
  componentName?: string;
  errorCategory?: string;
  retryAttempt?: number;
  formId?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Log error to Sentry with rich context
 */
export function logErrorBoundary(
  error: Error,
  context: ErrorLogContext
): void {
  Sentry.withScope((scope) => {
    // Set tags
    if (context.tier) {
      scope.setTag('error_boundary_tier', context.tier);
    }
    if (context.boundaryType) {
      scope.setTag('error_boundary_type', context.boundaryType);
    }
    if (context.errorCategory) {
      scope.setTag('error_category', context.errorCategory);
    }

    // Set user context
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    // Set custom context
    const { tier, boundaryType, errorCategory, userId, ...customContext } = context;
    if (Object.keys(customContext).length > 0) {
      scope.setContext('error_boundary', customContext);
    }

    // Capture exception
    Sentry.captureException(error);
  });
}
