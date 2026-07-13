"use client";

import Link from "next/link";
import { Map, Waves, Users, Thermometer } from "lucide-react";
import type { QuickLink } from "@/types/editorial-content";

interface QuickActionsBarProps {
  links: QuickLink[];
}

/**
 * Get icon component based on href content
 */
function getQuickLinkIcon(href: string) {
  if (href.includes("map")) return Map;
  if (href.includes("tide")) return Waves;
  if (href.includes("beginner")) return Users;
  if (href.includes("water-temp")) return Thermometer;
  if (href.includes("crowded")) return Users;
  return Map;
}

/**
 * Quick Actions Bar Component
 *
 * Horizontal row of pill-shaped navigation links for quick access
 * to related city pages (map, tides, beginner spots, etc.)
 */
export function QuickActionsBar({ links }: QuickActionsBarProps) {
  if (!links || links.length === 0) return null;

  return (
    <nav className="mt-8" aria-label="Quick navigation">
      <div className="flex flex-wrap gap-3">
        {links.map((link) => {
          const Icon = getQuickLinkIcon(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200
                       bg-white hover:bg-sky-50 hover:border-sky-200 transition-colors
                       text-sm font-medium text-slate-700 hover:text-sky-700"
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
