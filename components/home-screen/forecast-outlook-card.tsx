"use client";

import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForecastOutlookCardProps {
  className?: string;
  regionSlug?: string;
}

/**
 * ForecastOutlookCard - Entry point to regional 7-day forecast
 *
 * A compact card that links to the forecast hub, providing
 * authenticated users quick access to regional surf outlooks.
 */
export function ForecastOutlookCard({ className, regionSlug }: ForecastOutlookCardProps) {
  const descriptionId = "forecast-outlook-description";

  return (
    <Link
      href={regionSlug ? `/forecast/${regionSlug}` : "/forecast"}
      className={cn(
        "block rounded-xl bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50",
        "border border-sky-200 hover:border-sky-300",
        "p-4 transition-all duration-200",
        "hover:shadow-md hover:from-sky-100 hover:via-blue-50 hover:to-cyan-50",
        "group",
        className
      )}
      data-testid="forecast-outlook-card"
      aria-describedby={descriptionId}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 group-hover:bg-sky-200 transition-colors">
            <Calendar className="h-5 w-5 text-sky-600" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-sky-700 transition-colors">
              7-Day Outlook
            </h3>
            <p id={descriptionId} className="text-sm text-gray-600">
              Regional forecasts & best days
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
      </div>
    </Link>
  );
}
