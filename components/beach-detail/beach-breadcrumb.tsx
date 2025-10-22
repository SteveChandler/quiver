"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Beach } from "@/types/database";

interface BeachBreadcrumbProps {
  beach: Beach;
  className?: string;
}

export function BeachBreadcrumb({ beach, className }: BeachBreadcrumbProps) {
  const location = beach.location || beach.region || "California";

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-sm ${className || ""}`}
    >
      {/* Back to Map link */}
      <Link
        href="/map"
        className="inline-flex items-center gap-1 text-ocean-blue hover:text-ocean-blue/80 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back to Map</span>
        <span className="sm:hidden">Map</span>
      </Link>

      {/* Separator */}
      <ChevronRight className="h-3 w-3 text-muted-foreground" />

      {/* Location */}
      <span className="text-muted-foreground">{location}</span>

      {/* Separator */}
      <ChevronRight className="h-3 w-3 text-muted-foreground" />

      {/* Current beach (not a link) */}
      <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">
        {beach.name}
      </span>
    </nav>
  );
}
