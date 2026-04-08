"use client";

import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import { MAP_MOTION } from "@/lib/constants/animations";
import type { Beach } from "@/types/database";

interface BeachSearchBarProps {
  onSelect: (beach: Beach) => void;
  className?: string;
}

export function BeachSearchBar({ onSelect, className }: BeachSearchBarProps) {
  // Note: beach_search + beach_search_result_click events are emitted
  // centrally from BeachSearchAutocomplete via useTrackEvent.
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
              onSelect={onSelect}
              placeholder="Search by beach, spot, or region"
              showCurrentConditions={true}
              className="w-full border-none shadow-none"
              source="home"
            />
          </CardContent>
        </Card>
      </motion.div>
    </motion.section>
  );
}
