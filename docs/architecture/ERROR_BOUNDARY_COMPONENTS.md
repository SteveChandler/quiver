# Error Boundary Components - Technical Specifications

**Version**: 1.0
**Last Updated**: 2025-11-14
**Status**: Design Phase (Ready for Implementation)

## Overview

This document provides detailed technical specifications for all error boundary components to be implemented in the Quiver application. These specifications are ready for development teams to begin implementation.

## Table of Contents

- [Directory Structure](#directory-structure)
- [Core Boundary Components](#core-boundary-components)
- [Fallback UI Components](#fallback-ui-components)
- [Utility Functions](#utility-functions)
- [TypeScript Types](#typescript-types)
- [Usage Examples](#usage-examples)
- [Testing Specifications](#testing-specifications)

---

## Directory Structure

```
components/
└── error-boundaries/
    ├── index.ts                          # Barrel exports
    ├── ErrorBoundary.tsx                 # Generic boundary
    ├── DataErrorBoundary.tsx             # Data fetching boundary
    ├── FormErrorBoundary.tsx             # Form state boundary
    ├── ErrorFallback.tsx                 # Generic fallback UI
    ├── NetworkErrorFallback.tsx          # Network error UI
    ├── DataLoadErrorFallback.tsx         # Data loading error UI
    ├── types.ts                          # TypeScript types
    ├── utils/
    │   ├── retry-strategies.ts           # Retry logic
    │   ├── error-logger.ts               # Sentry integration
    │   ├── state-persistence.ts          # Form state saving
    │   └── error-categorizer.ts          # Error classification
    └── __tests__/
        ├── ErrorBoundary.test.tsx
        ├── DataErrorBoundary.test.tsx
        ├── FormErrorBoundary.test.tsx
        └── error-scenarios.test.tsx
```

---

## Core Boundary Components

### 1. ErrorBoundary.tsx

**Purpose**: Generic error boundary for any component

**Full Implementation Spec**:

```typescript
'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/nextjs';
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
    // Log error to Sentry with rich context
    Sentry.withScope((scope) => {
      // Boundary metadata
      scope.setTag('error_boundary_tier', this.props.tier || 'tier_4');
      scope.setTag('error_boundary_type', this.props.boundaryType || 'component');

      // Component context
      scope.setContext('component', {
        name: this.props.componentName || 'Unknown',
        stack: errorInfo.componentStack,
      });

      // Boundary state
      scope.setContext('boundary_state', {
        reset_count: this.state.resetCount,
        last_reset: this.state.lastResetTime,
      });

      // Capture exception
      Sentry.captureException(error);
    });

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
```

---

### 2. DataErrorBoundary.tsx

**Purpose**: Specialized boundary for data fetching with retry logic

**Full Implementation Spec**:

```typescript
'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/nextjs';
import { NetworkErrorFallback } from './NetworkErrorFallback';
import { DataLoadErrorFallback } from './DataLoadErrorFallback';
import { retryWithBackoff, RetryStrategy } from './utils/retry-strategies';
import { categorizeError, ErrorCategory } from './utils/error-categorizer';

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
    // Log to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('error_boundary_type', 'data_fetching');
      scope.setTag('error_category', this.state.errorCategory || 'unknown');
      scope.setTag('retry_attempted', 'true');

      scope.setContext('component', {
        name: this.props.componentName || 'Unknown',
        data_type: this.props.dataType,
        stack: errorInfo.componentStack,
      });

      Sentry.captureException(error);
    });

    this.setState({ errorInfo });

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
```

---

### 3. FormErrorBoundary.tsx

**Purpose**: Form-specific boundary with state preservation

**Full Implementation Spec**:

```typescript
'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/nextjs';
import { ErrorFallback } from './ErrorFallback';
import {
  saveFormState,
  loadFormState,
  clearFormState,
} from './utils/state-persistence';

export interface FormErrorBoundaryProps {
  /**
   * Callback fired when form error occurs
   * Receives error and current form state
   */
  onFormError?: (error: Error, formState?: any) => void;

  /**
   * Whether to preserve form state on error
   * Default: true
   */
  preserveState?: boolean;

  /**
   * Form identifier for state storage
   */
  formId: string;

  /**
   * Child form components
   */
  children: ReactNode;

  /**
   * Whether to auto-save form state periodically
   * Default: true
   */
  autoSave?: boolean;

  /**
   * Auto-save interval (milliseconds)
   * Default: 30000 (30 seconds)
   */
  autoSaveInterval?: number;

  /**
   * Custom recovery UI
   */
  recoveryFallback?: (
    error: Error,
    savedState: any,
    restore: () => void
  ) => ReactNode;
}

interface FormErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  savedFormState: any;
  isRestored: boolean;
}

export class FormErrorBoundary extends Component<
  FormErrorBoundaryProps,
  FormErrorBoundaryState
> {
  private autoSaveIntervalId: NodeJS.Timeout | null = null;

  constructor(props: FormErrorBoundaryProps) {
    super(props);

    // Load any previously saved state
    const savedState = loadFormState(props.formId);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      savedFormState: savedState,
      isRestored: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<FormErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidMount() {
    // Start auto-save if enabled
    if (this.props.autoSave !== false) {
      this.startAutoSave();
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { formId, preserveState = true } = this.props;

    // Save current form state before error
    if (preserveState) {
      // Extract form data from DOM
      const formData = this.extractFormData();
      saveFormState(formId, formData);

      this.setState({ savedFormState: formData });
    }

    // Log to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('error_boundary_type', 'form');
      scope.setTag('form_id', formId);
      scope.setTag('state_preserved', String(preserveState));

      scope.setContext('form_state', {
        has_saved_state: !!this.state.savedFormState,
        field_count: Object.keys(this.state.savedFormState || {}).length,
      });

      scope.setContext('component', {
        stack: errorInfo.componentStack,
      });

      Sentry.captureException(error);
    });

    this.setState({ errorInfo });

    // Call custom error handler
    if (this.props.onFormError) {
      this.props.onFormError(error, this.state.savedFormState);
    }
  }

  componentWillUnmount() {
    // Clear auto-save interval
    if (this.autoSaveIntervalId) {
      clearInterval(this.autoSaveIntervalId);
    }
  }

  startAutoSave() {
    const { autoSaveInterval = 30000, formId } = this.props;

    this.autoSaveIntervalId = setInterval(() => {
      if (!this.state.hasError) {
        const formData = this.extractFormData();
        saveFormState(formId, formData);
      }
    }, autoSaveInterval);
  }

  extractFormData(): Record<string, any> {
    // Find all form elements and extract their values
    const formElements = document.querySelectorAll(
      `[data-form-id="${this.props.formId}"] input, ` +
      `[data-form-id="${this.props.formId}"] textarea, ` +
      `[data-form-id="${this.props.formId}"] select`
    );

    const formData: Record<string, any> = {};

    formElements.forEach((element) => {
      const input = element as HTMLInputElement;
      const name = input.name || input.id;

      if (name) {
        if (input.type === 'checkbox') {
          formData[name] = input.checked;
        } else if (input.type === 'radio') {
          if (input.checked) {
            formData[name] = input.value;
          }
        } else {
          formData[name] = input.value;
        }
      }
    });

    return formData;
  }

  restoreFormState = () => {
    const { savedFormState } = this.state;
    const { formId } = this.props;

    if (!savedFormState) return;

    // Restore form values
    Object.entries(savedFormState).forEach(([name, value]) => {
      const element = document.querySelector(
        `[data-form-id="${formId}"] [name="${name}"], ` +
        `[data-form-id="${formId}"] [id="${name}"]`
      ) as HTMLInputElement;

      if (element) {
        if (element.type === 'checkbox') {
          element.checked = value as boolean;
        } else if (element.type === 'radio') {
          element.checked = element.value === value;
        } else {
          element.value = value as string;
        }

        // Trigger change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    this.setState({ isRestored: true });
  };

  resetError = () => {
    const { formId } = this.props;

    // Clear saved state
    clearFormState(formId);

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      savedFormState: null,
      isRestored: false,
    });
  };

  render() {
    const {
      hasError,
      error,
      savedFormState,
      isRestored,
    } = this.state;
    const { children, recoveryFallback } = this.props;

    if (!hasError) {
      return children;
    }

    // Custom recovery fallback
    if (recoveryFallback && savedFormState) {
      return recoveryFallback(error!, savedFormState, this.restoreFormState);
    }

    // Default form error UI
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">
            Form Error Occurred
          </h2>
          <p className="text-red-700 mb-4">
            An error occurred while processing your form, but your changes have
            been saved.
          </p>

          {savedFormState && (
            <div className="bg-white rounded-md p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Saved form data ({Object.keys(savedFormState).length} fields):
              </p>
              <div className="max-h-40 overflow-y-auto">
                <pre className="text-xs text-gray-700">
                  {JSON.stringify(savedFormState, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.restoreFormState}
              className="px-4 py-2 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 transition-colors"
              disabled={isRestored}
            >
              {isRestored ? 'Form Restored' : 'Restore Form'}
            </button>

            <button
              onClick={this.resetError}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600">
              Technical Details
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-x-auto">
              {error.toString()}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
```

---

## Fallback UI Components

### 1. ErrorFallback.tsx

**Generic error fallback UI**:

```typescript
'use client';

import React from 'react';
import { AlertCircle, Home, RefreshCw, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  showDetails?: boolean;
  title?: string;
  description?: string;
  componentName?: string;
  errorInfo?: React.ErrorInfo | null;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  }[];
}

export function ErrorFallback({
  error,
  resetError,
  showDetails = false,
  title = 'Something Went Wrong',
  description = 'We encountered an unexpected problem. Please try again or return home.',
  componentName,
  errorInfo,
  actions,
}: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {title}
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          {description}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          {/* Try Again */}
          <button
            onClick={resetError}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>

          {/* Go Home */}
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>

          {/* Get Help */}
          <Link
            href="/support"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            Get Help
          </Link>
        </div>

        {/* Custom Actions */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  action.variant === 'primary'
                    ? 'bg-ocean-blue text-white hover:bg-ocean-blue/90'
                    : action.variant === 'secondary'
                    ? 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Technical Details (Development Only) */}
        {showDetails && (
          <details className="text-left mt-6">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
              ▼ Technical Details
            </summary>
            <div className="mt-3 p-4 bg-gray-100 rounded-lg text-left">
              {componentName && (
                <p className="text-xs text-gray-600 mb-2">
                  Component: <span className="font-mono">{componentName}</span>
                </p>
              )}
              <p className="text-xs text-gray-600 mb-2">
                Error: <span className="font-mono text-red-600">{error.toString()}</span>
              </p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-600 cursor-pointer">
                    Stack Trace
                  </summary>
                  <pre className="mt-2 text-xs text-gray-700 overflow-x-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
              {errorInfo?.componentStack && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-600 cursor-pointer">
                    Component Stack
                  </summary>
                  <pre className="mt-2 text-xs text-gray-700 overflow-x-auto">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
```

---

### 2. NetworkErrorFallback.tsx

**Network-specific error UI**:

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Database } from 'lucide-react';

export interface NetworkErrorFallbackProps {
  error: Error;
  resetError: () => void;
  retryCount?: number;
  currentAttempt?: number;
  isRetrying?: boolean;
  cachedData?: any;
  onUseCachedData?: () => void;
}

export function NetworkErrorFallback({
  error,
  resetError,
  retryCount = 3,
  currentAttempt = 0,
  isRetrying = false,
  cachedData,
  onUseCachedData,
}: NetworkErrorFallbackProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-orange-100 p-4">
            <WifiOff className="h-12 w-12 text-orange-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Connection Lost
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-4">
          We're having trouble connecting to the internet. Check your
          connection and try again.
        </p>

        {/* Online/Offline Status */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-700">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Retry Progress */}
        {retryCount > 0 && currentAttempt > 0 && (
          <p className="text-sm text-gray-500 mb-4">
            Retry attempt: {currentAttempt} of {retryCount}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* Retry Button */}
          <button
            onClick={resetError}
            disabled={isRetrying}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>

          {/* View Cached Data */}
          {cachedData && onUseCachedData && (
            <button
              onClick={onUseCachedData}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <Database className="h-4 w-4" />
              View Cached Data
            </button>
          )}
        </div>

        {/* Offline Tips */}
        {!isOnline && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-left">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Offline Tips:
            </p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Check your Wi-Fi or cellular connection</li>
              <li>• Try moving to an area with better signal</li>
              <li>• Disable VPN if enabled</li>
              <li>• Restart your router</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 3. DataLoadErrorFallback.tsx

**Data loading error UI**:

```typescript
'use client';

import React from 'react';
import { Database, RefreshCw, SkipForward } from 'lucide-react';

export interface DataLoadErrorFallbackProps {
  error: Error;
  resetError: () => void;
  dataType?: string;
  lastSuccessfulLoad?: Date;
  cachedData?: any;
  onUseCachedData?: () => void;
}

export function DataLoadErrorFallback({
  error,
  resetError,
  dataType = 'data',
  lastSuccessfulLoad,
  cachedData,
  onUseCachedData,
}: DataLoadErrorFallbackProps) {
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <Database className="h-12 w-12 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Unable to Load {dataType}
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-4">
          We couldn't load the latest {dataType}.
          {lastSuccessfulLoad && ` Last updated ${formatTimeAgo(lastSuccessfulLoad)}.`}
        </p>

        {/* Cached Data Warning */}
        {cachedData && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ Cached {dataType} available
              {lastSuccessfulLoad && ` from ${formatTimeAgo(lastSuccessfulLoad)}`}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* Refresh */}
          <button
            onClick={resetError}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </button>

          {/* Use Cached */}
          {cachedData && onUseCachedData && (
            <button
              onClick={onUseCachedData}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <Database className="h-4 w-4" />
              Use Cached
            </button>
          )}

          {/* Skip */}
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <SkipForward className="h-4 w-4" />
            Skip
          </button>
        </div>

        {/* Error Details (optional) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-600 cursor-pointer">
              Error Details
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
              {error.toString()}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
```

---

## Utility Functions

### 1. retry-strategies.ts

```typescript
export type RetryStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Calculate retry delay based on strategy
 */
export function retryWithBackoff(
  attempt: number,
  strategy: RetryStrategy,
  baseDelay: number
): number {
  switch (strategy) {
    case 'exponential':
      return baseDelay * Math.pow(2, attempt);

    case 'linear':
      return baseDelay * (attempt + 1);

    case 'fixed':
    default:
      return baseDelay;
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    'network',
    'timeout',
    'fetch',
    'connection',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ];

  const errorMessage = error.message.toLowerCase();

  return retryableMessages.some((msg) => errorMessage.includes(msg));
}
```

---

### 2. error-categorizer.ts

```typescript
export type ErrorCategory =
  | 'network'
  | 'data_parsing'
  | 'rendering'
  | 'user_input'
  | 'system'
  | 'unknown';

/**
 * Categorize error type
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    errorName.includes('networkerror')
  ) {
    return 'network';
  }

  // Data parsing errors
  if (
    message.includes('json') ||
    message.includes('parse') ||
    message.includes('validation') ||
    message.includes('schema') ||
    errorName.includes('syntaxerror')
  ) {
    return 'data_parsing';
  }

  // Rendering errors
  if (
    message.includes('render') ||
    message.includes('hydration') ||
    message.includes('undefined') ||
    message.includes('null') ||
    errorName.includes('typeerror') ||
    errorName.includes('referenceerror')
  ) {
    return 'rendering';
  }

  // User input errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required')
  ) {
    return 'user_input';
  }

  // System errors
  if (
    message.includes('memory') ||
    message.includes('storage') ||
    message.includes('quota') ||
    errorName.includes('rangeerror')
  ) {
    return 'system';
  }

  return 'unknown';
}
```

---

### 3. state-persistence.ts

```typescript
const STORAGE_PREFIX = 'quiver_form_state_';
const STORAGE_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours

interface StoredFormState {
  data: any;
  timestamp: number;
  formId: string;
}

/**
 * Save form state to localStorage
 */
export function saveFormState(formId: string, data: any): void {
  try {
    const state: StoredFormState = {
      data,
      timestamp: Date.now(),
      formId,
    };

    localStorage.setItem(
      `${STORAGE_PREFIX}${formId}`,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error('Failed to save form state:', error);
  }
}

/**
 * Load form state from localStorage
 */
export function loadFormState(formId: string): any | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${formId}`);

    if (!stored) return null;

    const state: StoredFormState = JSON.parse(stored);

    // Check if expired
    const age = Date.now() - state.timestamp;
    if (age > STORAGE_EXPIRY_MS) {
      clearFormState(formId);
      return null;
    }

    return state.data;
  } catch (error) {
    console.error('Failed to load form state:', error);
    return null;
  }
}

/**
 * Clear form state from localStorage
 */
export function clearFormState(formId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${formId}`);
  } catch (error) {
    console.error('Failed to clear form state:', error);
  }
}

/**
 * Clear all expired form states
 */
export function clearExpiredFormStates(): void {
  try {
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const state: StoredFormState = JSON.parse(stored);
          const age = Date.now() - state.timestamp;

          if (age > STORAGE_EXPIRY_MS) {
            localStorage.removeItem(key);
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to clear expired form states:', error);
  }
}
```

---

### 4. error-logger.ts

```typescript
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
```

---

## TypeScript Types

**File**: `components/error-boundaries/types.ts`

```typescript
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
```

---

## Barrel Export

**File**: `components/error-boundaries/index.ts`

```typescript
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
export { retryWithBackoff, isRetryableError } from './utils/retry-strategies';
export type { RetryStrategy } from './utils/retry-strategies';

export { categorizeError } from './utils/error-categorizer';
export type { ErrorCategory } from './utils/error-categorizer';

export {
  saveFormState,
  loadFormState,
  clearFormState,
  clearExpiredFormStates,
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
```

---

## Usage Examples

### Example 1: Basic Component Protection

```typescript
import { ErrorBoundary } from '@/components/error-boundaries';

export function BeachCard({ beach }) {
  return (
    <ErrorBoundary componentName="BeachCard">
      <div className="beach-card">
        {/* Component content */}
      </div>
    </ErrorBoundary>
  );
}
```

---

### Example 2: Data Fetching with Retry

```typescript
import { DataErrorBoundary } from '@/components/error-boundaries';

export function ForecastDisplay({ beachId }) {
  return (
    <DataErrorBoundary
      retryCount={3}
      retryStrategy="exponential"
      dataType="forecast"
      componentName="ForecastDisplay"
    >
      <ForecastContent beachId={beachId} />
    </DataErrorBoundary>
  );
}
```

---

### Example 3: Form with State Preservation

```typescript
import { FormErrorBoundary } from '@/components/error-boundaries';

export function SessionLogForm() {
  return (
    <FormErrorBoundary
      formId="session-log-form"
      preserveState={true}
      autoSave={true}
      autoSaveInterval={30000}
    >
      <form data-form-id="session-log-form">
        {/* Form fields */}
      </form>
    </FormErrorBoundary>
  );
}
```

---

## Testing Specifications

### Unit Test Template

```typescript
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('catches errors and displays fallback', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  // Add more tests...
});
```

---

## Next Steps

1. **Review Specifications**: Team review of component designs
2. **Create Components**: Implement according to specs
3. **Write Tests**: Unit and integration tests
4. **Documentation**: Usage guide and examples
5. **Integration**: Deploy to routes and features

---

**Document Status**: Ready for Implementation
**Estimated Implementation Time**: 4 weeks (see roadmap)
**Dependencies**: Sentry SDK, React 18+, Next.js 14+
**Last Updated**: 2025-11-14
