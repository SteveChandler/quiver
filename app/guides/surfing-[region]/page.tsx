import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Users, TrendingUp, Waves } from "lucide-react";
import dynamic from "next/dynamic";

import {
  HUB_REGION_SLUGS,
  getHubRegion,
  type HubRegion,
} from "@/lib/data/hub-regions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { getBeachesByState } from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";

// Dynamic import for HubMapView (client component with Mapbox)
const HubMapView = dynamic(
  () =>
    import("@/components/hub/hub-map-view").then((mod) => ({
      default: mod.HubMapView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600 mx-auto" />
          <p className="text-sm text-slate-500">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export const revalidate = 3600; // Revalidate every hour

export async function generateStaticParams() {
  return HUB_REGION_SLUGS.map((slug) => ({
    region: slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { region: string };
}): Promise<Metadata> {
  const region = getHubRegion(params.region);

  if (!region) {
    return {};
  }

  return buildPageMetadata({
    title: region.title,
    description: region.description,
    path: `/guides/surfing-${region.slug}`,
    keywords: [
      `${region.name} surf guide`,
      `${region.name} surf spots`,
      `${region.name} surfing`,
      "surf forecast",
      "surf conditions",
    ],
  });
}

/**
 * Generate FAQ items for hub region
 */
function generateHubFAQ(region: HubRegion, beachCount: number) {
  return [
    {
      question: `How many surf spots are in ${region.name}?`,
      answer: `${region.name} has ${beachCount} surf spots documented in Quiver's database, ranging from beginner-friendly beach breaks to advanced reef and point breaks.`,
    },
    {
      question: `What are the best months to surf in ${region.name}?`,
      answer: `${region.name} offers year-round surfing opportunities. The best conditions typically vary by specific location and swell direction. Use Quiver's forecast tools to check real-time conditions.`,
    },
    {
      question: `Can I find beginner surf spots in ${region.name}?`,
      answer: `Yes! ${region.name} has numerous beginner-friendly surf spots. Use the beginner filter in the map below or explore our beginner-specific guides to find spots suitable for learning.`,
    },
    {
      question: `How do I get surf forecasts for ${region.name}?`,
      answer: `Quiver provides detailed surf forecasts for all beaches in ${region.name}, including wave height, wind conditions, tide information, and crowd predictions. Sign up for free to access forecasts.`,
    },
  ];
}

/**
 * Calculate region statistics from beaches
 */
function calculateRegionStats(beaches: Beach[]) {
  const beginnerCount = beaches.filter((b) => {
    const skill = b.skill_level?.toLowerCase() || "";
    return skill.includes("beginner") || skill.includes("longboard");
  }).length;

  const intermediateCount = beaches.filter((b) => {
    const skill = b.skill_level?.toLowerCase() || "";
    return (
      !skill.includes("beginner") &&
      !skill.includes("longboard") &&
      !skill.includes("advanced") &&
      !skill.includes("expert")
    );
  }).length;

  const advancedCount = beaches.filter((b) => {
    const skill = b.skill_level?.toLowerCase() || "";
    return skill.includes("advanced") || skill.includes("expert");
  }).length;

  // Group by city
  const cities = new Set(
    beaches.map((b) => b.city).filter((city): city is string => !!city)
  );

  return {
    total: beaches.length,
    beginner: beginnerCount,
    intermediate: intermediateCount,
    advanced: advancedCount,
    cities: cities.size,
  };
}

export default async function HubRegionPage({
  params,
}: {
  params: { region: string };
}) {
  const region = getHubRegion(params.region);

  if (!region) {
    return notFound();
  }

  // Fetch all beaches for the region's states
  const allBeaches: Beach[] = [];
  for (const stateSlug of region.states) {
    const result = await getBeachesByState(stateSlug);
    if (result.success && result.data) {
      allBeaches.push(...result.data);
    }
  }

  if (allBeaches.length === 0) {
    return notFound();
  }

  const stats = calculateRegionStats(allBeaches);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  return (
    <div className="bg-white min-h-screen">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Surf Guides", url: `${baseUrl}/guides` },
          {
            name: region.name,
            url: `${baseUrl}/guides/surfing-${region.slug}`,
          },
        ]}
      />
      <FAQSchema items={generateHubFAQ(region, stats.total)} />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <nav className="text-sm mb-4">
            <Link
              href="/guides"
              className="text-ocean-blue hover:underline inline-flex items-center gap-1"
            >
              ← Back to Surf Guides
            </Link>
          </nav>

          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            {region.title}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl">
            {region.description}
          </p>
        </header>

        {/* Stats Cards */}
        <section className="mb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-lg p-4 border border-sky-200">
              <div className="flex items-center gap-2 mb-2">
                <Waves className="h-5 w-5 text-sky-600" />
                <h3 className="text-sm font-medium text-gray-700">
                  Total Spots
                </h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h3 className="text-sm font-medium text-gray-700">Beginner</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {stats.beginner}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-medium text-gray-700">
                  Intermediate
                </h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {stats.intermediate}
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-slate-600" />
                <h3 className="text-sm font-medium text-gray-700">Advanced</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {stats.advanced}
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Map */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Explore Surf Spots
          </h2>
          <p className="text-gray-600 mb-4">
            Click any marker to view spot details. Markers are color-coded by
            skill level: green for beginner, blue for intermediate, dark for
            advanced.
          </p>
          <div className="h-96 rounded-lg overflow-hidden border border-gray-200 shadow-lg">
            <HubMapView
              beaches={allBeaches}
              centerLatitude={region.centerLat}
              centerLongitude={region.centerLon}
              zoom={region.zoom}
            />
          </div>
        </section>

        {/* Quick Links Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Browse by Category
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {region.states.map((stateSlug) => (
              <div key={stateSlug}>
                <Link
                  href={`/beginner/${stateSlug}`}
                  className="block p-4 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Beginner Spots
                  </h3>
                  <p className="text-sm text-gray-600">
                    Find gentle waves perfect for learning
                  </p>
                </Link>
              </div>
            ))}
            {region.states.map((stateSlug) => (
              <div key={`crowded-${stateSlug}`}>
                <Link
                  href={`/least-crowded/${stateSlug}`}
                  className="block p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Least Crowded
                  </h3>
                  <p className="text-sm text-gray-600">
                    Escape the crowds at hidden gems
                  </p>
                </Link>
              </div>
            ))}
            {region.states.map((stateSlug) => (
              <div key={`tide-${stateSlug}`}>
                <Link
                  href={`/tide/${stateSlug}`}
                  className="block p-4 rounded-lg border border-gray-200 hover:border-sky-500 hover:bg-sky-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Tide Reports
                  </h3>
                  <p className="text-sm text-gray-600">
                    Check optimal tide windows
                  </p>
                </Link>
              </div>
            ))}
            {region.states.map((stateSlug) => (
              <div key={`temp-${stateSlug}`}>
                <Link
                  href={`/water-temp/${stateSlug}`}
                  className="block p-4 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Water Temp
                  </h3>
                  <p className="text-sm text-gray-600">
                    See current water temperatures
                  </p>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* About Section */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            About {region.name} Surfing
          </h2>
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <p className="text-gray-700 mb-4">{region.description}</p>
            <p className="text-gray-700">
              Use Quiver to track conditions, plan sessions, and connect with
              the local surf community. Get real-time forecasts, tide charts,
              and crowd predictions for every spot in {region.name}.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
