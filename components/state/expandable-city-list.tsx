"use client";

import { useState } from "react";

const VISIBLE_COUNT = 10;

interface ExpandableCityListProps {
  /** Total number of cities in the list */
  totalCount: number;
  children: React.ReactNode;
}

/**
 * Wraps a city list to show the first 10 items with a "Show more" toggle.
 *
 * All items are always in the DOM (server-rendered) for crawler discovery.
 * Only the visual display is toggled via CSS.
 */
export function ExpandableCityList({
  totalCount,
  children,
}: ExpandableCityListProps) {
  const [expanded, setExpanded] = useState(false);
  const needsExpansion = totalCount > VISIBLE_COUNT;

  if (!needsExpansion) {
    return <>{children}</>;
  }

  return (
    <>
      <div className={expanded ? undefined : "city-list-collapsed"}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="mt-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-ocean-blue hover:bg-slate-50 transition-colors focus-ring"
      >
        {expanded
          ? "Show fewer cities"
          : `Show all ${totalCount} cities`}
      </button>
      {/* CSS-only collapse: items are always in the DOM for crawlers */}
      <style>{`
        .city-list-collapsed > ul > li:nth-child(n+${VISIBLE_COUNT + 1}) {
          display: none;
        }
      `}</style>
    </>
  );
}
