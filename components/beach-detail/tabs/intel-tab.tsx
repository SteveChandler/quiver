"use client";

import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";

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
  return (
    <div className="py-6">
      <BeachIntelSection
        beachId={beach.id}
        beachName={beach.name}
        latitude={beach.latitude}
        longitude={beach.longitude}
        navigateOnViewAll={false}
        initialShowAll={initialShowAll}
      />
    </div>
  );
}
