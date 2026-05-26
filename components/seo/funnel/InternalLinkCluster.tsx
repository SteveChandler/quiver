import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { SeoInternalLink } from "@/lib/seo/funnel-pages";

interface InternalLinkClusterProps {
  title: string;
  links: SeoInternalLink[];
}

const MAX_INTERNAL_LINKS = 6;

const KIND_LABEL_BY_LINK_KIND: Record<
  NonNullable<SeoInternalLink["kind"]>,
  string
> = {
  beach: "Beach",
  cam: "Cam",
  forecast: "Forecast",
  guide: "Guide",
  map: "Map",
  tide: "Tide",
  "water-temp": "Water temp",
};

export function InternalLinkCluster({
  title,
  links,
}: InternalLinkClusterProps) {
  if (links.length === 0) return null;

  const featuredLinks = links.slice(0, MAX_INTERNAL_LINKS);

  return (
    <section aria-labelledby="internal-link-cluster-heading" className="py-4">
      <h2
        id="internal-link-cluster-heading"
        className="font-heading text-2xl font-bold text-gray-900"
      >
        {title}
      </h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {featuredLinks.map((link) => (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-ocean-blue/40 hover:shadow-md"
          >
            {link.kind ? (
              <span className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wide text-ocean-blue">
                {KIND_LABEL_BY_LINK_KIND[link.kind]}
              </span>
            ) : null}
            <span className="flex items-center justify-between gap-3 font-heading text-base font-bold text-gray-900 group-hover:text-ocean-blue">
              {link.label}
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </span>
            {link.description ? (
              <span className="mt-2 block text-sm leading-6 text-gray-600">
                {link.description}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
