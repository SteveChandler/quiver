'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { saveHomeBeach, searchBeaches, getPopularBeaches, getNearbyBeaches, type BeachBasicInfo } from './actions';

function HomeBeachPickerContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BeachBasicInfo[]>([]);
  const [nearbyBeaches, setNearbyBeaches] = useState<BeachBasicInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBeach, setSelectedBeach] = useState<BeachBasicInfo | null>(null);

  // Load nearby/popular beaches on mount
  useEffect(() => {
    const loadBeaches = async () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            // User granted location - show nearby beaches
            const beaches = await getNearbyBeaches(
              position.coords.latitude,
              position.coords.longitude
            );
            setNearbyBeaches(beaches);
          },
          async () => {
            // Geolocation denied or failed - show popular defaults
            const beaches = await getPopularBeaches();
            setNearbyBeaches(beaches);
          }
        );
      } else {
        // No geolocation available - load popular defaults
        const beaches = await getPopularBeaches();
        setNearbyBeaches(beaches);
      }
    };
    loadBeaches();
  }, []);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const beaches = await searchBeaches(q);
    setResults(beaches);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = async (beach: BeachBasicInfo) => {
    if (!token) {
      setError('Missing token. Please use the link from your email.');
      return;
    }

    setIsSaving(true);
    setSelectedBeach(beach);
    setError(null);

    const result = await saveHomeBeach(token, beach.id);

    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error || 'Failed to save');
      setSelectedBeach(null);
    }

    setIsSaving(false);
  };

  // Format location string
  const formatLocation = (beach: BeachBasicInfo): string => {
    const parts = [beach.city, beach.state].filter(Boolean);
    return parts.join(', ') || beach.country || '';
  };

  // No token error
  if (!token) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-4xl mb-4">X</div>
          <h1 className="text-xl font-semibold text-red-600 mb-2">Missing Token</h1>
          <p className="text-gray-600">Please use the link from your email.</p>
        </div>
      </div>
    );
  }

  // Success state
  if (saved && selectedBeach) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-4xl mb-4 text-green-600">&#10003;</div>
          <h1 className="text-xl font-semibold text-green-600 mb-2">Done!</h1>
          <p className="text-gray-600 mb-2">
            Your home beach is now set to:
          </p>
          <p className="font-medium text-gray-900 mb-6">{selectedBeach.name}</p>
          <Link
            href="/"
            className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Open Quiver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 mt-8">
          Pick your home break
        </h1>
        <p className="text-gray-600 mb-6">
          We&apos;ll prioritize this beach in your daily emails.
        </p>

        {/* Search input */}
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search beaches..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={isSaving}
          />
          {isSearching && (
            <div className="absolute right-3 top-3 text-gray-400 text-sm">
              Searching...
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Saving indicator */}
        {isSaving && (
          <div className="bg-blue-50 text-blue-600 p-3 rounded-lg mb-4">
            Saving...
          </div>
        )}

        {/* Search results */}
        {results.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Search Results
            </h2>
            <ul className="bg-white rounded-lg shadow divide-y divide-gray-100">
              {results.map((beach) => (
                <li key={beach.id}>
                  <button
                    onClick={() => handleSelect(beach)}
                    disabled={isSaving}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 disabled:opacity-50 transition-colors focus-ring"
                  >
                    <div className="font-medium text-gray-900">{beach.name}</div>
                    {formatLocation(beach) && (
                      <div className="text-sm text-gray-500">
                        {formatLocation(beach)}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nearby/Popular suggestions */}
        {nearbyBeaches.length > 0 && query.length < 2 && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Popular Beaches
            </h2>
            <ul className="bg-white rounded-lg shadow divide-y divide-gray-100">
              {nearbyBeaches.map((beach) => (
                <li key={beach.id}>
                  <button
                    onClick={() => handleSelect(beach)}
                    disabled={isSaving}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 disabled:opacity-50 transition-colors focus-ring"
                  >
                    <div className="font-medium text-gray-900">{beach.name}</div>
                    {formatLocation(beach) && (
                      <div className="text-sm text-gray-500">
                        {formatLocation(beach)}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* No results */}
        {query.length >= 2 && !isSearching && results.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No beaches found matching &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeBeachPicker() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      }
    >
      <HomeBeachPickerContent />
    </Suspense>
  );
}
