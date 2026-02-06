import type { Metadata } from "next";
import Link from "next/link";

import { buildPageMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildPageMetadata({
  title: "Browse Surf Beaches by Region",
  description:
    "Explore surf beaches across the United States and Mexico. Find real-time conditions, AI-powered forecasts, and community reviews for thousands of breaks.",
  path: "/beaches",
});

export default function BeachesIndexPage() {
  const regions = [
    {
      name: "United States",
      href: "/beaches/usa",
      description:
        "Browse surf spots across 16 coastal states from California to Maine. Over 5,000 beaches with live forecasts.",
    },
    {
      name: "Mexico",
      href: "/beaches/mexico",
      description:
        "Explore surf breaks along Baja California and the Pacific coast. World-class waves without the crowds.",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <header className="mb-8">
        <nav aria-label="breadcrumb" className="text-sm text-gray-600 mb-4">
          <Link href="/" className="hover:underline text-ocean-blue">
            Home
          </Link>
          <span className="mx-2 text-gray-400">&rsaquo;</span>
          <span className="text-gray-900 font-medium">Beaches</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Browse surf beaches by region
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Pick a region to explore surf cities, beach conditions, and
          AI-powered forecasts.
        </p>
      </header>

      <section
        aria-label="Regions"
        className="grid gap-4 sm:grid-cols-2"
      >
        {regions.map((region) => (
          <Link
            key={region.href}
            href={region.href}
            className="rounded-xl border border-slate-200 bg-white p-6 hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-slate-900">
              {region.name}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {region.description}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
