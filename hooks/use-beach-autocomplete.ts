import { useState, useCallback, useMemo, useEffect } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import type { Beach } from "@/types/database";

/**
 * Debounce utility function
 * Delays execution of a function until after a specified delay
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

interface UseBeachAutocompleteOptions {
  debounceMs?: number;
  maxResults?: number;
  minQueryLength?: number;
  initialQuery?: string;
}

export function useBeachAutocomplete(options: UseBeachAutocompleteOptions = {}) {
  const {
    debounceMs = 300,
    maxResults = 5,
    minQueryLength = 2,
    initialQuery = "",
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Memoize debounced query setter to prevent recreation
  const debouncedSetQuery = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedQuery(value);
      }, debounceMs),
    [debounceMs]
  );

  // Update debounced query when query changes
  useEffect(() => {
    debouncedSetQuery(query);
  }, [query, debouncedSetQuery]);

  // Memoized fetch function for beach search
  const fetchBeaches = useCallback(async () => {
    if (debouncedQuery.length < minQueryLength) {
      return [];
    }

    const response = await fetch(
      `/api/beaches/search?query=${encodeURIComponent(debouncedQuery)}`
    );

    if (!response.ok) {
      throw new Error("Failed to search beaches");
    }

    const result = await response.json();
    const beaches: Beach[] = result.data || [];
    return beaches.slice(0, maxResults);
  }, [debouncedQuery, maxResults, minQueryLength]);

  const {
    data: suggestions,
    loading,
    error,
  } = useDataFetcher<Beach[]>(fetchBeaches, {
    immediate: false,
    initialData: [],
  });

  // Track autocomplete errors that are silently swallowed
  useEffect(() => {
    if (error) {
      trackFallback({ domain: 'search', field: 'autocomplete', fallbackValue: '[]' });
    }
  }, [error]);

  // Keyboard navigation handlers
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || !suggestions || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setQuery("");
          setDebouncedQuery("");
          break;
      }
    },
    [isOpen, suggestions]
  );

  const handleSelect = useCallback((beach: Beach) => {
    setIsOpen(false);
    setQuery(beach.name);
    setDebouncedQuery(beach.name);
    setSelectedIndex(0);
    return beach;
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
    setSelectedIndex(0);
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
    if (value.length < minQueryLength) {
      setIsOpen(false);
    } else {
      // Open dropdown immediately when query is valid length
      // API calls will still be debounced via debouncedQuery
      setIsOpen(true);
    }
  }, [minQueryLength]);

  return {
    query,
    suggestions: suggestions || [],
    loading,
    error,
    isOpen,
    selectedIndex,
    setQuery: handleQueryChange,
    handleKeyDown,
    handleSelect,
    clearSearch,
    setIsOpen,
  };
}
