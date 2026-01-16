import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  SURF_CITY_SLUGS,
  SURF_INTENTS,
  type SurfCitySlug,
  type SurfIntentSlug,
  type SurfSpot,
  getCityBySlug,
  getSpotsForIntent,
} from "@/lib/data/surf-spots";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";
import { CityMapView } from "@/components/city/city-map-view";
import type { BeachWithMetrics } from "@/types/location";
import { isValidStateSlug, getUsStateDisplayNameFromSlug } from "@/lib/utils/beach-url-utils";
import { parseLocationFromSlug } from "@/lib/utils/location-slug";
import { getBeachesByIntentAndCity, getBeachesByIntentAndState } from "@/actions/beach/beach-query-actions";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";
import { StateMapView } from "@/components/state/state-map-view";

export const revalidate = 1800;

function formatPacificDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export async function generateStaticParams() {
  const params: Array<{ intent: SurfIntentSlug; city: SurfCitySlug }> = [];
  SURF_CITY_SLUGS.forEach((citySlug) => {
    const city = getCityBySlug(citySlug);
    if (!city) return;
    city.featuredIntents.forEach((intent) => {
      params.push({ intent, city: citySlug });
    });
  });
  return params;
}

interface IntentPageParams {
  // NOTE: although this page is primarily for surf intents, this route also
  // receives legacy 2-segment state/city URLs (e.g. /ca/encinitas).
  params: { intent: string; city: string };
}

export async function generateMetadata({
  params,
}: IntentPageParams): Promise<Metadata> {
  // Check if this is a state-level intent page like /beginner/ca
  if (isValidStateSlug(params.city) && SURF_INTENTS[params.intent as SurfIntentSlug]) {
    const stateName = getUsStateDisplayNameFromSlug(params.city);
    const definition = SURF_INTENTS[params.intent as SurfIntentSlug];
    return buildPageMetadata({
      title: `${definition.label} Spots in ${stateName}`,
      description: `Find the best ${definition.label.toLowerCase()} surf spots across ${stateName}. AI-powered recommendations for every skill level.`,
      path: `/${params.intent}/${params.city}`,
    });
  }

  // If this is a legacy state/city URL, we redirect in the page render.
  // Metadata can't redirect, so just avoid surf-intent metadata generation.
  if (isValidStateSlug(params.intent)) {
    const cityName = parseLocationFromSlug(params.city);
    return buildPageMetadata({
      title: `Surf spots in ${cityName} | Quiver`,
      description: `Open the surf map filtered to ${cityName}.`,
      path: `/${params.intent}/${params.city}`,
    });
  }

  const city = getCityBySlug(params.city);
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];
  if (!city || !definition) return {};

  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
  }).format(now);

  const title = definition.titleTemplate({ cityName: city.name });
  const topSpotNames = getSpotsForIntent(
    city.slug,
    params.intent as SurfIntentSlug
  )
    .slice(0, 3)
    .map((spot) => spot.name);
  const description = definition.metaDescription({
    cityName: city.name,
    topSpots: topSpotNames,
  });

  return buildPageMetadata({
    title,
    description: `Updated ${formattedDate}. ${description}`,
    path: `/${params.intent}/${city.slug}`,
    keywords: [
      `${city.name} ${definition.label}`,
      `${city.name} ${params.intent} surf guide`,
      `${city.name} surf ${definition.label.toLowerCase()}`,
      "Quiver session planning",
    ],
  });
}

export default async function IntentPage({ params }: IntentPageParams) {
  const city = getCityBySlug(params.city);
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];

  // Legacy 2-segment state/city route: redirect to map filtered by city
  // Examples: /ca/encinitas, /or/newport
  if (isValidStateSlug(params.intent)) {
    const cityName = parseLocationFromSlug(params.city);
    const redirectTo = `/map?search=${encodeURIComponent(cityName)}`;

    redirect(redirectTo);
  }

  // Check if this is a state-level intent page like /beginner/ca
  if (isValidStateSlug(params.city) && SURF_INTENTS[params.intent as SurfIntentSlug]) {
    const stateName = getUsStateDisplayNameFromSlug(params.city);
    const intentDefinition = SURF_INTENTS[params.intent as SurfIntentSlug];

    const beachesResult = await getBeachesByIntentAndState(params.intent, params.city);

    if (!beachesResult.success || !beachesResult.data || beachesResult.data.length === 0) {
      return notFound();
    }

    const beaches = beachesResult.data;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

    // Render state-level intent page
    return (
      <div className="bg-white">
        <BreadcrumbStructuredData
          items={[
            { name: "Quiver", url: baseUrl },
            { name: `${stateName} Surf`, url: `${baseUrl}/beaches/usa/${params.city}` },
            { name: intentDefinition.label, url: `${baseUrl}/${params.intent}/${params.city}` },
          ]}
        />
        <FAQSchema
          items={generateIntentFAQ(
            params.intent as SurfIntentSlug,
            stateName,
            beaches.slice(0, 3).map((b) => b.name)
          )}
        />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              {intentDefinition.heading({ cityName: stateName })}
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              {beaches.length} spots across {stateName}
            </p>
            <p className="text-base text-slate-700 mt-4">
              {intentDefinition.intro({ cityName: stateName })}
            </p>
          </header>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              {intentDefinition.label} spots in {stateName}
            </h2>
            <StateMapView
              beaches={beaches}
              ariaLabel={`${intentDefinition.label} spots in ${stateName}`}
            />
          </section>
        </div>
      </div>
    );
  }

  if (!city || !definition) {
    return notFound();
  }

  // Try database first, then fall back to hardcoded data
  const beachesResult = await getBeachesByIntentAndCity(
    params.intent,
    params.city,
    "ca" // Default to CA for now - most curated cities are in California
  );

  let spots: SurfSpot[];

  if (beachesResult.success && beachesResult.data && beachesResult.data.length > 0) {
    // Use database results - add metrics fields for transformer compatibility
    const beachesWithMetrics: BeachWithMetrics[] = beachesResult.data.map(beach => ({
      ...beach,
      compositeScore: 0,
      recentIntelCount: 0,
      avgConfirmations: 0,
    }));
    spots = transformBeachesToSurfSpots(beachesWithMetrics);
  } else {
    // Fall back to hardcoded data
    const hardcodedSpots = getSpotsForIntent(city.slug, params.intent as SurfIntentSlug);
    if (hardcodedSpots.length === 0) {
      return notFound();
    }
    spots = hardcodedSpots;
  }

  if (spots.length === 0) {
    return notFound();
  }

  const now = new Date();
  const updatedAt = formatPacificDateTime(now);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const regionLabel = city.regionLabel || `${city.name}, California`;

  // Transform spots to minimal BeachWithMetrics for the map
  const beachesForMap: BeachWithMetrics[] = spots.map(
    (spot) =>
      ({
        id: spot.id || spot.slug,
        slug: spot.slug,
        name: spot.name,
        lat: spot.coordinates.lat,
        lon: spot.coordinates.lng,
        // Minimal dummy data for BeachWithMetrics compliance
        city: city.name,
        state: "CA",
        region: spot.region,
        description: spot.overview,
        compositeScore: 0,
        recentIntelCount: 0,
        avgConfirmations: 0,
        created_at: "",
        updated_at: "",
      } as unknown as BeachWithMetrics)
  );

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${baseUrl.replace(/\/$/, "")}/` },
          {
            name: `${city.name} Surf`,
            url: `${baseUrl.replace(/\/$/, "")}/beaches/usa/ca/${city.slug}`,
          },
          {
            name: definition.label,
            url: `${baseUrl.replace(/\/$/, "")}/${params.intent}/${city.slug}`,
          },
        ]}
      />
      <FAQSchema
        items={generateIntentFAQ(
          params.intent as SurfIntentSlug,
          city.name,
          spots.slice(0, 3).map((s) => s.name)
        )}
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-1 text-sm mb-6"
        >
          <Link
            href={`/beaches/usa/ca/${city.slug}`}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {city.name}
          </Link>
          <span className="text-gray-400 mx-2">›</span>
          <span className="text-gray-900 font-medium">{definition.label}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {definition.heading({ cityName: city.name })}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>

          <div className="space-y-2 mt-6">
            <p className="text-base text-slate-700">
              Updated {updatedAt} · Dialed recommendations refresh every 30
              minutes based on tide, wind, and crowd telemetry from Quiver.
            </p>
            <p className="text-base text-slate-700">
              {definition.intro({ cityName: city.name })} We pair it with live
              data so you can decide whether to stay put, scoot north up the
              freeway, or log a sunset session after work.
            </p>
          </div>
        </header>

        <div className="space-y-12">
          {/* Map & List Section */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              Top spot recommendations
            </h2>
            <p className="mb-6 text-sm text-slate-600">
              Sort your quiver, choose the right tide window, and jot down a
              backup in case the main peak gets stacked.
            </p>

            <CityMapView
              spots={spots}
              cityName={city.name}
              citySlug={city.slug}
              stateSlug="ca"
              countrySlug="usa"
            />
          </section>

          {/* Editorial Focus Section */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              What to focus on today
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {definition.focusPoints.map((point) => (
                <li
                  key={point}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-inner"
                >
                  {point}
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Logging Tips */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                Session logging tips
              </h2>
              <p className="text-slate-700 leading-relaxed">
                Once you wrap the surf, drop a note in your Quiver journal with
                tide, board, and crowd observations. Over time you&apos;ll see
                crystal-clear patterns about when {city.name} rewards this type
                of session objective.
              </p>
            </section>

            {/* Checklist & Links */}
            <aside className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-inner">
                <h2 className="text-lg font-semibold text-slate-900">
                  Rapid-fire checklist
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>
                    Screenshot the tide window and share it with your crew.
                  </li>
                  <li>
                    Pack the board that matches the fastest section above.
                  </li>
                  <li>
                    Stash a backup parking plan in notes—crowds shift quickly on
                    pulsy swells.
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Continue exploring
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-sky-700">
                  <li>
                    <a
                      href={`/beaches/usa/ca/${city.slug}`}
                      className="underline-offset-2 hover:underline"
                    >
                      Back to the {city.name} surf hub
                    </a>
                  </li>
                  <li>
                    <a
                      href={`/least-crowded/${city.slug}`}
                      className="underline-offset-2 hover:underline"
                    >
                      Less-crowded backups
                    </a>
                  </li>
                  <li>
                    <a
                      href={`/water-temp/${city.slug}`}
                      className="underline-offset-2 hover:underline"
                    >
                      Water temperature trends
                    </a>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
