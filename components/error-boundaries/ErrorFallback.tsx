'use client';

import React from 'react';
import { AlertCircle, Home, RefreshCw, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-3">
          {title}
        </h1>

        {/* Description */}
        <p className="text-muted-foreground mb-6">
          {description}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          {/* Try Again */}
          <Button onClick={resetError}>
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>

          {/* Go Home */}
          <Button variant="secondary" asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>

          {/* Get Help */}
          <Button variant="outline" asChild>
            <Link href="/support">
              <HelpCircle className="h-4 w-4" />
              Get Help
            </Link>
          </Button>
        </div>

        {/* Custom Actions */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {actions.map((action, index) => (
              <Button
                key={index}
                onClick={action.onClick}
                variant={
                  action.variant === 'primary'
                    ? 'default'
                    : action.variant === 'secondary'
                    ? 'secondary'
                    : 'outline'
                }
                size="sm"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Technical Details (Development Only) */}
        {showDetails && (
          <details className="text-left mt-6">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              ▼ Technical Details
            </summary>
            <div className="mt-3 p-4 bg-muted rounded-lg text-left">
              {componentName && (
                <p className="text-xs text-muted-foreground mb-2">
                  Component: <span className="font-mono">{componentName}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mb-2">
                Error: <span className="font-mono text-destructive">{error.toString()}</span>
              </p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Stack Trace
                  </summary>
                  <pre className="mt-2 text-xs text-foreground/70 overflow-x-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
              {errorInfo?.componentStack && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Component Stack
                  </summary>
                  <pre className="mt-2 text-xs text-foreground/70 overflow-x-auto">
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
