'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { ErrorFallback } from './ErrorFallback';

export interface ErrorBoundaryProps {
  /**
   * Custom fallback UI to display when error occurs
   * Receives error object and reset function
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;

  /**
   * Callback fired when error is caught
   * Useful for custom logging or side effects
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Array of values that trigger boundary reset when changed
   * Similar to useEffect dependencies
   */
  resetKeys?: any[];

  /**
   * Child components to protect
   */
  children: ReactNode;

  /**
   * Optional component name for logging context
   */
  componentName?: string;

  /**
   * Whether to show technical error details in development
   * Default: true in dev, false in production
   */
  showDetails?: boolean;

  /**
   * Error boundary tier for logging
   */
  tier?: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

  /**
   * Error boundary type for logging
   */
  boundaryType?: 'global' | 'route' | 'feature' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  resetCount: number;
  lastResetTime: number | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      resetCount: 0,
      lastResetTime: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to Sentry with rich context (lazy-loaded to defer ~555KB from initial bundle)
    const tier = this.props.tier || 'tier_4';
    const boundaryType = this.props.boundaryType || 'component';
    const componentName = this.props.componentName || 'Unknown';
    const resetCount = this.state.resetCount;
    const lastResetTime = this.state.lastResetTime;
    import('@sentry/nextjs').then(Sentry => {
      Sentry.withScope((scope) => {
        // Boundary metadata
        scope.setTag('error_boundary_tier', tier);
        scope.setTag('error_boundary_type', boundaryType);

        // Component context
        scope.setContext('component', {
          name: componentName,
          stack: errorInfo.componentStack,
        });

        // Boundary state
        scope.setContext('boundary_state', {
          reset_count: resetCount,
          last_reset: lastResetTime,
        });

        // Capture exception
        Sentry.captureException(error);
      });
    }).catch(() => {});

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-reset when resetKeys change
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      !this.areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.resetError();
    }
  }

  areResetKeysEqual(prev: any[] | undefined, next: any[] | undefined): boolean {
    if (!prev && !next) return true;
    if (!prev || !next) return false;
    if (prev.length !== next.length) return false;

    return prev.every((key, index) => key === next[index]);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      resetCount: this.state.resetCount + 1,
      lastResetTime: Date.now(),
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          showDetails={
            this.props.showDetails ?? process.env.NODE_ENV === 'development'
          }
          componentName={this.props.componentName}
          errorInfo={this.state.errorInfo}
        />
      );
    }

    // No error, render children
    return this.props.children;
  }
}
