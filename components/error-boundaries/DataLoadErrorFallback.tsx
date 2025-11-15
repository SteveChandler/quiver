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
          We couldn&apos;t load the latest {dataType}.
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
