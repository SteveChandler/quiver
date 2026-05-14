"use client";

import Link from "next/link";
import { Compass, Map, ArrowRight } from "lucide-react";
import { buildHiCityUrlForBeach } from "@/lib/utils/beach-url-utils";
import type { Beach } from "@/types/database";

interface ExploreMoreLinksProps {
  beach: Beach;
}

const cardClass =
  "group flex items-center gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-4 shadow-[3px_3px_0_#11100D] transition-transform hover:-translate-y-0.5";

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
          <div className="flex-shrink-0 rounded-full border-2 border-[#11100D] bg-[#0B3A75] p-2 text-[#F4EBD8]">
            <card.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-black uppercase text-[#11100D] transition-colors group-hover:text-[#0B3A75]">
              {card.title}
            </p>
            <p className="text-xs font-medium text-[#5F5646]">
              {card.description}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#C46A24] transition-transform group-hover:translate-x-1" />
        </Link>
      ))}
    </div>
  );
}
