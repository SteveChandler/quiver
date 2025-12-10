"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";
import { validateCoordinates } from "@/lib/coordinate-validation";

const BeachIntelSection = dynamic(
  () =>
    import("@/components/intel/beach-intel-section").then(
      (m) => m.BeachIntelSection
    ),
  { ssr: false }
);

interface IntelTabProps {
  beach: Beach;
  initialShowAll?: boolean;
}

export function IntelTab({ beach, initialShowAll = false }: IntelTabProps) {
  // Validate coordinates in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (!validateCoordinates(beach.lat, beach.lon, `IntelTab: ${beach.name}`)) {
        console.warn(`⚠️ IntelTab received beach with invalid coordinates`);
        console.warn(`  Beach: ${beach.name} (${beach.id})`);
        console.warn(`  Latitude: ${beach.lat}`);
        console.warn(`  Longitude: ${beach.lon}`);
      }
    }
  }, [beach.lat, beach.lon, beach.name, beach.id]);

  return (
    <div className="py-6">
      <BeachIntelSection
        beachId={beach.id}
        beachName={beach.name}
        latitude={beach.lat ?? 0}
        longitude={beach.lon ?? 0}
        navigateOnViewAll={false}
        initialShowAll={initialShowAll}
      />
    </div>
  );
}
