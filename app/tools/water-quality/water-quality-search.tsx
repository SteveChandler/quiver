"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import type { Beach } from "@/types/database";

interface WaterQualitySearchProps {
  placeholder?: string;
}

export function WaterQualitySearch({
  placeholder = "Search for a CA or HI beach...",
}: WaterQualitySearchProps) {
  const router = useRouter();

  const handleSelect = useCallback(
    (beach: Beach) => {
      if (beach.slug) {
        router.push(`/tools/water-quality?beach=${beach.slug}`);
      }
    },
    [router]
  );

  return (
    <BeachSearchAutocomplete
      onSelect={handleSelect}
      placeholder={placeholder}
      maxResults={6}
    />
  );
}
