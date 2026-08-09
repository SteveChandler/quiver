"use client";

import { MapSkeleton } from "@/components/skeletons/map-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

const TOOLBAR_ACTION_WIDTHS = ["lg:w-24", "lg:w-32", "lg:w-40", "lg:w-48"] as const;

export function MapFirstPaintShell() {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-[#F5ECD8]"
      data-testid="map-first-paint-shell"
      aria-label="Surf spots map loading"
    >
      <div className="flex flex-col gap-2 border-b-2 border-black/15 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-11 w-full bg-black/10 motion-reduce:animate-none lg:max-w-md" />
        <div className="grid w-full grid-cols-4 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
          {TOOLBAR_ACTION_WIDTHS.map((widthClass, index) => (
            <Skeleton
              key={index}
              data-testid="map-toolbar-skeleton-action"
              className={`h-11 w-full bg-black/10 motion-reduce:animate-none ${widthClass}`}
            />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <MapSkeleton />
      </div>
    </section>
  );
}
