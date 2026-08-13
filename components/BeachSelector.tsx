"use client";

import { useState, useEffect, useRef, useId } from "react";
import { data } from "@/lib/data/client";
import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { ClientBeach } from "@/lib/data/client";
import { searchBeachesMultiple } from "@/lib/utils/beach-search-utils";

export function BeachSelector({
  onBeachSelected,
  initialValue,
  inputId,
}: {
  onBeachSelected: (beach: ClientBeach) => void;
  initialValue?: string;
  inputId?: string;
}) {
  const [allBeaches, setAllBeaches] = useState<ClientBeach[]>([]);
  const [query, setQuery] = useState(initialValue || "");
  const [matches, setMatches] = useState<ClientBeach[]>([]);
  const [selectionMade, setSelectionMade] = useState(!!initialValue);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch all beaches once on mount via data gateway
  const fetchBeaches = useCallback(async () => {
    return await data.beaches.getAll();
  }, []);

  const {
    data: beaches,
    loading: loadingBeaches,
    error: beachesError,
  } = useDataFetcher<ClientBeach[]>(fetchBeaches);

  useEffect(() => {
    if (beaches) {
      setAllBeaches(beaches);
    }
  }, [beaches]);

  // 2. Debounced search using searchBeachesMultiple (fuzzy matching)
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query || selectionMade) {
      // Show first 50 beaches when no query or after selection
      setMatches(allBeaches.slice(0, 50));
      setIsSearching(false);
      return;
    }

    // Debounce search by 300ms
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchBeachesMultiple(query);
        // searchBeachesMultiple currently returns the full DB Beach shape (lat/lon).
        // Normalize to the client-safe Beach shape (latitude/longitude).
        setMatches(
          results.map((b: any) => ({
            id: b.id,
            name: b.name,
            latitude: b.latitude ?? b.lat ?? null,
            longitude: b.longitude ?? b.lon ?? null,
          }))
        );
      } catch (error) {
        console.error("Error searching beaches:", error);
        setMatches([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, allBeaches, selectionMade]);

  // Set initial value when it changes
  useEffect(() => {
    if (initialValue && initialValue !== query) {
      setQuery(initialValue);
      setSelectionMade(true);
    }
  }, [initialValue, query]);

  // 3. When the user picks something (click or select)
  const trySelect = (beachName: string) => {
    if (!beachName?.trim()) return;

    const normalizedQuery = beachName.toLowerCase().trim();

    // Try exact match first
    let found = allBeaches.find(
      (b) => b.name.toLowerCase() === normalizedQuery
    );

    // If no exact match, try partial match
    if (!found) {
      found = allBeaches.find(
        (b) =>
          b.name.toLowerCase().includes(normalizedQuery) ||
          normalizedQuery.includes(b.name.toLowerCase())
      );
    }

    if (found) {
      setQuery(found.name); // Use the actual beach name from database
      setSelectionMade(true);
      onBeachSelected(found);
    } else {
      // Fall back: accept free-typed value to proceed, with empty id
      const typed: ClientBeach = {
        id: "",
        name: beachName.trim(),
        latitude: 0,
        longitude: 0,
      };
      setSelectionMade(true);
      onBeachSelected(typed);
    }
  };

  const noMatch =
    !!query && matches.length === 0 && !loadingBeaches && allBeaches.length > 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectionMade(false); // Reset selection state when input changes to show dropdown

    // Keep parent form in sync with free-typed input so required field logic can enable submit
    const typed: ClientBeach = {
      id: "",
      name: value,
      latitude: 0,
      longitude: 0,
    };
    onBeachSelected(typed);
  };

  const handleFocus = () => {
    setSelectionMade(false); // Always show dropdown when focusing
  };

  const handleBlur = () => {
    // Only try to select if the user hasn't manually cleared the field
    if (query.trim()) {
      setTimeout(() => trySelect(query), 100); // Small delay to allow for clicks on dropdown items
    }
  };

  const generatedInputId = useId();
  const inputIdToUse = inputId ?? `${generatedInputId}-beach-input`;

  return (
    <div className="relative">
      <input
        id={inputIdToUse}
        aria-label="Search beaches"
        className="border rounded p-2 w-full"
        value={query}
        placeholder="Type or select a beach"
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        data-testid="beach-search-input"
      />
      {selectionMade && query && (
        <button
          type="button"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10 focus-ring"
          onClick={() => {
            setQuery("");
            setSelectionMade(false);
            // Clear the selection in the parent component
            const emptyBeach: ClientBeach = {
              id: "",
              name: "",
              latitude: 0,
              longitude: 0,
            };
            onBeachSelected(emptyBeach);
          }}
          title="Clear selection"
          aria-label="Clear selected beach"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}

      {!selectionMade && query && (
        <>
          <ul className="absolute top-full left-0 right-0 z-50 mt-1 border rounded bg-white shadow-lg max-h-60 overflow-auto">
            {isSearching ? (
              <li className="p-2 text-gray-500 text-sm">Searching...</li>
            ) : matches.length > 0 ? (
              matches.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className="w-full p-2 text-left hover:bg-gray-100 focus-ring"
                    onMouseDown={() => {
                      setQuery(b.name);
                      trySelect(b.name);
                    }}
                    onClick={() => {
                      setQuery(b.name);
                      trySelect(b.name);
                    }}
                  >
                    {b.name}
                  </button>
                </li>
              ))
            ) : (
              <li className="p-2 text-gray-500 text-sm">No beaches found</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
