'use client';

import React from 'react';
import { Database, RefreshCw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
          <div className="rounded-full bg-destructive/10 p-4">
            <Database className="h-12 w-12 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-foreground mb-2">
          Unable to Load {dataType}
        </h2>

        {/* Description */}
        <p className="text-muted-foreground mb-4">
          We couldn&apos;t load the latest {dataType}.
          {lastSuccessfulLoad && ` Last updated ${formatTimeAgo(lastSuccessfulLoad)}.`}
        </p>

        {/* Cached Data Warning */}
        {cachedData && (
          <div className="mb-6 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning">
              ⚠️ Cached {dataType} available
              {lastSuccessfulLoad && ` from ${formatTimeAgo(lastSuccessfulLoad)}`}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* Refresh */}
          <Button onClick={resetError}>
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </Button>

          {/* Use Cached */}
          {cachedData && onUseCachedData && (
            <Button variant="secondary" onClick={onUseCachedData}>
              <Database className="h-4 w-4" />
              Use Cached
            </Button>
          )}

          {/* Skip */}
          <Button variant="outline" onClick={() => window.history.back()}>
            <SkipForward className="h-4 w-4" />
            Skip
          </Button>
        </div>

        {/* Error Details (optional) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-muted-foreground cursor-pointer">
              Error Details
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
              {error.toString()}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
