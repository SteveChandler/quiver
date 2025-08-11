"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { searchBeachesByName } from "@/lib/utils/beach-search-utils";
import type { Beach } from "@/types/database";

interface BeachSearchBarProps {
  onSelect: (beach: Beach) => void;
  className?: string;
}

export function BeachSearchBar({ onSelect, className }: BeachSearchBarProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Memoized search function; execution is controlled manually via refetch
  const performSearch = useCallback(async () => {
    if (!query.trim()) {
      return null as unknown as Beach | null;
    }
    return await searchBeachesByName(query.trim());
  }, [query]);

  const { loading, refetch } = useDataFetcher<Beach | null>(performSearch, {
    immediate: false,
    onSuccess: (beach) => {
      if (beach && beach.id) {
        setError(null);
        onSelect(beach);
      } else {
        setError("No beach found. Try again.");
      }
    },
    onError: () => {
      setError("Search failed. Please try again.");
    },
  });

  const canSearch = useMemo(
    () => query.trim().length > 0 && !loading,
    [query, loading]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      await refetch();
    },
    [refetch]
  );

  return (
    <section className={className}>
      <Card className="w-full mx-auto">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Search beaches (e.g., OB, PB, La Jolla Shores)"
                className="pl-9"
                aria-label="Search beaches"
              />
            </div>
            <Button
              type="submit"
              disabled={!canSearch}
              className="min-w-[96px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Search
                </>
              ) : (
                "Search"
              )}
            </Button>
          </form>
          {error && (
            <p className="text-sm text-red-600 mt-2" aria-live="polite">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
