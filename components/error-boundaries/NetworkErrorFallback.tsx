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
          We&apos;re having trouble connecting to the internet. Check your
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
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>

          {/* View Cached Data */}
          {cachedData && onUseCachedData && (
            <button
              onClick={onUseCachedData}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors focus-ring"
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
