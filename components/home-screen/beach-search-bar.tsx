"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { searchBeachesByName } from "@/lib/utils/beach-search-utils";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import { track } from "@/lib/analytics";
import { MAP_MOTION } from "@/lib/constants/animations";
import type { Beach } from "@/types/database";

interface BeachSearchBarProps {
  onSelect: (beach: Beach) => void;
  className?: string;
}

export function BeachSearchBar({ onSelect, className }: BeachSearchBarProps) {
  const handleSelect = useCallback(
    (beach: Beach) => {
      // Track beach search outcome (home)
      track("beach_search", {
        query: beach.name,
        result_count: 1,
        source: "home",
      });
      onSelect(beach);
    },
    [onSelect]
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
            <BeachSearchAutocomplete
              onSelect={handleSelect}
              placeholder="Search by beach, spot, or region"
              showCurrentConditions={true}
              className="w-full border-none shadow-none"
            />
          </CardContent>
        </Card>
      </motion.div>
    </motion.section>
  );
}
