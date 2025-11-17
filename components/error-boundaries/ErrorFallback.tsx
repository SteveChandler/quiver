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
