"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { searchBeachesByName } from "@/lib/utils/beach-search-utils";
import { MAP_MOTION } from "@/lib/constants/animations";
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
    <motion.section 
      className={className}
      variants={MAP_MOTION.locationSearch}
      initial="initial"
      animate="animate"
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Card className="w-full mx-auto">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <motion.div 
                className="relative flex-1"
                whileFocus={{ scale: 1.01 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <motion.div
                  animate={query ? { rotate: [0, 10, -10, 0] } : {}}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </motion.div>
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Search beaches (e.g., OB, PB, La Jolla Shores)"
                  className="pl-9 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                  aria-label="Search beaches"
                />
              </motion.div>
              
              <motion.div
                variants={MAP_MOTION.quickAction}
                initial="rest"
                whileHover="hover"
                whileTap="pressed"
              >
                <Button
                  type="submit"
                  disabled={!canSearch}
                  className="min-w-[96px]"
                >
                  {loading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center"
                    >
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Search
                    </motion.div>
                  ) : (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      Search
                    </motion.span>
                  )}
                </Button>
              </motion.div>
            </form>
            
            <AnimatePresence>
              {error && (
                <motion.p 
                  className="text-sm text-red-600 mt-2" 
                  aria-live="polite"
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </motion.section>
  );
}
