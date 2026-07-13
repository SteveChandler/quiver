"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";
import { validateCoordinates } from "@/lib/coordinate-validation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  publicMode?: boolean;
  previewCount?: number;
}

export function IntelTab({
  beach,
  initialShowAll = false,
  publicMode = false,
  previewCount,
}: IntelTabProps) {
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

  if (beach.lat == null || beach.lon == null) {
    return (
      <div className="py-6">
        <Card>
          <CardHeader>
            <CardTitle>Local Intel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Local intel is unavailable for this spot right now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-6">
      <BeachIntelSection
        beachId={beach.id}
        beachName={beach.name}
        latitude={beach.lat}
        longitude={beach.lon}
        navigateOnViewAll={false}
        initialShowAll={initialShowAll}
        publicMode={publicMode}
        previewCount={previewCount}
      />
    </div>
  );
}
