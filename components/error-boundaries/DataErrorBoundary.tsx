'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { NetworkErrorFallback } from './NetworkErrorFallback';
import { DataLoadErrorFallback } from './DataLoadErrorFallback';
import { retryWithBackoff, RetryStrategy } from './utils/retry-strategies';
import { categorizeError, ErrorCategory, isChunkLoadError } from './utils/error-categorizer';

export interface DataErrorBoundaryProps {
  /**
   * Optional cached/fallback data to display if fetch fails
   */
  fallbackData?: any;

  /**
   * Maximum number of automatic retry attempts
   * Default: 3
   */
  retryCount?: number;

  /**
   * Retry delay strategy
   * 'exponential': 1s, 2s, 4s, 8s...
   * 'linear': 1s, 2s, 3s, 4s...
   * 'fixed': constant delay
   */
  retryStrategy?: RetryStrategy;

  /**
   * Base delay for retry (milliseconds)
   * Default: 1000
   */
  retryDelay?: number;

  /**
   * Child components that fetch data
   */
  children: ReactNode;

  /**
   * Custom loading indicator during retry
   */
  retryLoadingIndicator?: ReactNode;

  /**
   * Whether to show cached data with staleness indicator
   * Default: true
   */
  showCachedData?: boolean;

  /**
   * Callback when all retries exhausted
   */
  onRetryExhausted?: (error: Error) => void;

  /**
   * Data type being loaded (for error messages)
   */
  dataType?: string;

  /**
   * Component name for logging
   */
  componentName?: string;
}

interface DataErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCategory: ErrorCategory | null;
  isRetrying: boolean;
  retryAttempt: number;
  showingCachedData: boolean;
}

export class DataErrorBoundary extends Component<
  DataErrorBoundaryProps,
  DataErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: DataErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCategory: null,
      isRetrying: false,
      retryAttempt: 0,
      showingCachedData: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<DataErrorBoundaryState> {
    const errorCategory = categorizeError(error);

    return {
      hasError: true,
      error,
      errorCategory,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to Sentry (lazy-loaded to defer ~555KB from initial bundle)
    const errorCategory = this.state.errorCategory;
    const componentName = this.props.componentName || 'Unknown';
    const dataType = this.props.dataType;
    import('@sentry/nextjs').then(Sentry => {
      Sentry.withScope((scope) => {
        scope.setTag('error_boundary_type', 'data_fetching');
        scope.setTag('error_category', errorCategory || 'unknown');
        scope.setTag('retry_attempted', 'true');

        scope.setContext('component', {
          name: componentName,
          data_type: dataType,
          stack: errorInfo.componentStack,
        });

        Sentry.captureException(error);
      });
    }).catch(() => {});

    this.setState({ errorInfo });

    // Chunk load errors need a full page reload, not a component retry.
    // Delegate to ChunkErrorHandler's global listener by re-dispatching,
    // since error boundaries swallow errors before they reach window.
    if (isChunkLoadError(error)) {
      window.dispatchEvent(
        new ErrorEvent('error', { error })
      );
      return;
    }

    // Start automatic retry if appropriate
    if (this.shouldAutoRetry()) {
      this.startRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  shouldAutoRetry(): boolean {
    const { retryAttempt } = this.state;
    const { retryCount = 3 } = this.props;
    const { errorCategory } = this.state;

    // Don't retry if max attempts reached
    if (retryAttempt >= retryCount) return false;

    // Don't retry for user errors or system errors
    if (errorCategory === 'user_input' || errorCategory === 'system') {
      return false;
    }

    // Retry for network and data errors
    return errorCategory === 'network' || errorCategory === 'data_parsing';
  }

  startRetry = () => {
    const {
      retryStrategy = 'exponential',
      retryDelay = 1000,
    } = this.props;
    const { retryAttempt } = this.state;

    this.setState({ isRetrying: true });

    const delay = retryWithBackoff(
      retryAttempt,
      retryStrategy,
      retryDelay
    );

    this.retryTimeoutId = setTimeout(() => {
      this.resetError();
    }, delay);
  };

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCategory: null,
      isRetrying: false,
      retryAttempt: this.state.retryAttempt + 1,
      showingCachedData: false,
    });
  };

  handleManualRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    this.setState({ retryAttempt: 0 }, () => {
      this.resetError();
    });
  };

  handleUseCachedData = () => {
    this.setState({ showingCachedData: true });
  };

  render() {
    const {
      hasError,
      error,
      errorCategory,
      isRetrying,
      retryAttempt,
      showingCachedData,
    } = this.state;

    const {
      children,
      fallbackData,
      retryCount = 3,
      retryLoadingIndicator,
      showCachedData = true,
      onRetryExhausted,
      dataType,
    } = this.props;

    // No error, render children
    if (!hasError) {
      return children;
    }

    // Showing cached data
    if (showingCachedData && fallbackData) {
      return (
        <>
          {/* Cached data banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Showing cached {dataType || 'data'} due to connection issues
            </p>
          </div>
          {/* Render children with fallback data */}
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child, { data: fallbackData } as any)
              : child
          )}
        </>
      );
    }

    // Retrying
    if (isRetrying) {
      return (
        retryLoadingIndicator || (
          <div className="flex flex-col items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean-blue mb-4" />
            <p className="text-gray-600">
              Retrying... (Attempt {retryAttempt + 1} of {retryCount})
            </p>
          </div>
        )
      );
    }

    // Max retries exhausted
    if (retryAttempt >= retryCount && onRetryExhausted) {
      onRetryExhausted(error!);
    }

    // Network error
    if (errorCategory === 'network') {
      return (
        <NetworkErrorFallback
          error={error!}
          resetError={this.handleManualRetry}
          retryCount={retryCount}
          currentAttempt={retryAttempt}
          isRetrying={isRetrying}
          cachedData={fallbackData}
          onUseCachedData={
            showCachedData && fallbackData
              ? this.handleUseCachedData
              : undefined
          }
        />
      );
    }

    // Data loading error
    return (
      <DataLoadErrorFallback
        error={error!}
        resetError={this.handleManualRetry}
        dataType={dataType}
        cachedData={fallbackData}
        onUseCachedData={
          showCachedData && fallbackData
            ? this.handleUseCachedData
            : undefined
        }
      />
    );
  }
}
