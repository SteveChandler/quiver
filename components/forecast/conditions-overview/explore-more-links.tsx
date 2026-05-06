"use client";

import Link from "next/link";
import { Compass, Map, ArrowRight } from "lucide-react";
import { buildHiCityUrlForBeach } from "@/lib/utils/beach-url-utils";
import type { Beach } from "@/types/database";

interface ExploreMoreLinksProps {
  beach: Beach;
}

const cardClass =
  "group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-sm transition-colors hover:bg-slate-50";

export function ExploreMoreLinks({ beach }: ExploreMoreLinksProps) {
  const cards = [
    {
      href: buildHiCityUrlForBeach(beach),
      icon: Compass,
      title: `${beach.city ?? "Local"} Surf Guide`,
      description: "Compare conditions across all local breaks",
    },
    {
      href: "/map",
      icon: Map,
      title: "Nearby Beaches on Map",
      description: "Explore surf spots in the area",
    },
  ];

  return (
    <div
      data-testid="conditions-explore-more-links"
      className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className={cardClass}>
          <div className="flex-shrink-0 rounded-xl bg-blue-50 p-2 text-blue-600">
            <card.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 transition-colors group-hover:text-blue-600">
              {card.title}
            </p>
            <p className="text-xs text-slate-500">{card.description}</p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" />
        </Link>
      ))}
    </div>
  );
}
