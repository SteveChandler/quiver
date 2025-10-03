"use client";

import { useState, useEffect, useRef } from "react";
import { data } from "@/lib/data/client";
import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Beach } from "@/types/database";
import { searchBeachesMultiple } from "@/lib/utils/beach-search-utils";

export function BeachSelector({
  onBeachSelected,
  initialValue,
}: {
  onBeachSelected: (beach: Beach) => void;
  initialValue?: string;
}) {
  const [allBeaches, setAllBeaches] = useState<Beach[]>([]);
  const [query, setQuery] = useState(initialValue || "");
  const [matches, setMatches] = useState<Beach[]>([]);
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
  } = useDataFetcher<Beach[]>(fetchBeaches);

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
        setMatches(results);
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
      const typed: Beach = {
        id: "",
        name: beachName.trim(),
        latitude: 0,
        longitude: 0,
        created_at: "",
        updated_at: "",
      } as any;
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
    const typed: Beach = {
      id: "",
      name: value,
      latitude: 0,
      longitude: 0,
      created_at: "",
      updated_at: "",
    } as any;
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

  return (
    <div className="flex flex-col space-y-1">
      <div className="relative">
        <input
          id="beach-input"
          className="border rounded p-2 w-full"
          value={query}
          placeholder="Type or select a beach"
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          data-testid="beach-search-input"
          list="beach-list"
        />
        {selectionMade && query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => {
              setQuery("");
              setSelectionMade(false);
              // Clear the selection in the parent component
              const emptyBeach = {
                id: "",
                name: "",
                latitude: 0,
                longitude: 0,
                created_at: "",
                updated_at: "",
              };
              onBeachSelected(emptyBeach);
            }}
            title="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {!selectionMade && query && (
        <>
          <datalist id="beach-list">
            {matches.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>

          {/* Intentionally hide dropdown-only error to allow free-typed entries */}

          <ul className="absolute z-50 w-full border rounded bg-white shadow-lg max-h-60 overflow-auto mt-1">
            {isSearching ? (
              <li className="p-2 text-gray-500 text-sm">Searching...</li>
            ) : matches.length > 0 ? (
              matches.map((b) => (
                <li
                  key={b.id}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                  onMouseDown={() => {
                    setQuery(b.name);
                    trySelect(b.name);
                  }}
                >
                  {b.name}
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
