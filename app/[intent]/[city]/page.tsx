import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  SURF_INTENTS,
  type SurfIntentSlug,
} from "@/lib/constants/surf-intents";
import type { SurfSpot } from "@/lib/data/surf-spots";
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
import { findCityBySlug, type CityMetadata } from "@/actions/city/city-metadata-actions";
import { buildIntentPageContent } from "@/lib/seo/intent-content-templates";
import { getAllCitiesWithBeaches, getTopCitiesInState } from "@/actions/beach/beach-location-actions";
import { detectCityCollisions, buildCitySlug, US_STATE_SLUGS } from "@/lib/seo/city-slug-utils";
import { PopularCitiesForIntent } from "@/components/intent/popular-cities-for-intent";
import type { IntentKey } from "@/lib/constants/intent-definitions";

export const dynamic = "force-dynamic";

function formatPacificDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

const INTENT_SLUGS: SurfIntentSlug[] = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];
const US_STATES = Object.values(US_STATE_SLUGS);

export async function generateStaticParams() {
  const params: Array<{ intent: string; city: string }> = [];

  try {
    // Get all cities with at least 1 beach
    const citiesResult = await getAllCitiesWithBeaches(1);
    if (citiesResult.success && citiesResult.data) {
      // Detect collisions
      const collisionMap = detectCityCollisions(citiesResult.data);

      // Generate city × intent combinations
      for (const cityRecord of citiesResult.data) {
        const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
        if (!citySlug) continue;

        for (const intent of INTENT_SLUGS) {
          params.push({ intent, city: citySlug });
        }
      }
    }
  } catch (error) {
    console.error("generateStaticParams: Failed to fetch cities", error);
  }

  // Add state-level intent params (e.g., /beginner/ca)
  for (const state of US_STATES) {
    for (const intent of INTENT_SLUGS) {
      params.push({ intent, city: state });
    }
  }

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

  // Database-driven city metadata
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];
  if (!definition) return {};

  const cityResult = await findCityBySlug(params.city);
  if (!cityResult.success || !cityResult.data) return {};

  const cityMetadata = cityResult.data;
  const pageContent = buildIntentPageContent(params.intent as SurfIntentSlug, cityMetadata);

  return buildPageMetadata({
    title: pageContent.title,
    description: pageContent.metaDescription,
    path: `/${params.intent}/${params.city}`,
    keywords: [
      `${cityMetadata.cityName} ${definition.label}`,
      `${cityMetadata.cityName} surf`,
      `${cityMetadata.stateName} surfing`,
    ],
  });
}

export default async function IntentPage({ params }: IntentPageParams) {
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
    const beaches = beachesResult.success && beachesResult.data ? beachesResult.data : [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

    // Fetch top cities in this state for PopularCitiesForIntent component
    const topCities = await getTopCitiesInState(params.city);

    // Render state-level intent page (with empty state if no beaches)
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

          {beaches.length === 0 ? (
            <section className="mb-8">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  No {intentDefinition.label.toLowerCase()} spots found in {stateName}
                </h2>
                <p className="text-slate-600 mb-4">
                  We&apos;re expanding our coverage. Explore other regions or browse all surf spots.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/map" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ocean-blue transition-colors">
                    Explore the Map
                  </Link>
                  <Link href={`/beaches/usa/${params.city}`} className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                    All {stateName} Beaches
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                  {intentDefinition.label} spots in {stateName}
                </h2>
                <StateMapView
                  beaches={beaches}
                  ariaLabel={`${intentDefinition.label} spots in ${stateName}`}
                />
              </section>

              {/* Focus Points */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                  What to focus on
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {intentDefinition.focusPoints.map((point) => (
                    <li
                      key={point}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-inner"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Popular Cities - Links DOWN to city intent pages */}
              {topCities.length > 0 && (
                <section className="mt-8">
                  <PopularCitiesForIntent
                    intentKey={params.intent as IntentKey}
                    intentLabel={intentDefinition.label}
                    stateName={stateName}
                    cities={topCities}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Database-driven city resolution (replaces hardcoded SURF_CITIES)
  const cityResult = await findCityBySlug(params.city);
  const cityMetadata = cityResult.success ? cityResult.data : null;

  if (!cityMetadata || !definition) {
    return notFound();
  }

  // Generate content from templates
  const pageContent = buildIntentPageContent(params.intent as SurfIntentSlug, cityMetadata);

  // Fetch beaches from database using resolved city name (handles accents like Rincón)
  const beachesResult = await getBeachesByIntentAndCity(
    params.intent,
    cityMetadata.cityName,
    cityMetadata.state.toLowerCase()
  );

  if (!beachesResult.success || !beachesResult.data || beachesResult.data.length === 0) {
    return notFound();
  }

  // Transform database results - add metrics fields for transformer compatibility
  const beachesWithMetrics: BeachWithMetrics[] = beachesResult.data.map(beach => ({
    ...beach,
    compositeScore: 0,
    recentIntelCount: 0,
    avgConfirmations: 0,
  }));
  const spots: SurfSpot[] = transformBeachesToSurfSpots(beachesWithMetrics);

  const now = new Date();
  const updatedAt = formatPacificDateTime(now);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  const regionLabel = `${cityMetadata.cityName}, ${cityMetadata.stateName}`;

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${baseUrl.replace(/\/$/, "")}/` },
          {
            name: `${cityMetadata.cityName} Surf`,
            url: `${baseUrl.replace(/\/$/, "")}/beaches/usa/${cityMetadata.state.toLowerCase()}/${params.city}`,
          },
          {
            name: definition.label,
            url: `${baseUrl.replace(/\/$/, "")}/${params.intent}/${params.city}`,
          },
        ]}
      />
      <FAQSchema
        items={generateIntentFAQ(
          params.intent as SurfIntentSlug,
          cityMetadata.cityName,
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
            href={`/beaches/usa/${cityMetadata.state.toLowerCase()}/${params.city}`}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {cityMetadata.cityName}
          </Link>
          <span className="text-gray-400 mx-2">›</span>
          <span className="text-gray-900 font-medium">{definition.label}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {pageContent.heading}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>

          <div className="space-y-2 mt-6">
            <p className="text-base text-slate-700">
              Updated {updatedAt} · Dialed recommendations refresh every 30
              minutes based on tide, wind, and crowd telemetry from Quiver.
            </p>
            <p className="text-base text-slate-700">
              {pageContent.intro}
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
              cityName={cityMetadata.cityName}
              citySlug={params.city}
              stateSlug={cityMetadata.state.toLowerCase()}
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
                crystal-clear patterns about when {cityMetadata.cityName} rewards this type
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
                      href={`/beaches/usa/${cityMetadata.state.toLowerCase()}/${params.city}`}
                      className="underline-offset-2 hover:underline"
                    >
                      Back to the {cityMetadata.cityName} surf hub
                    </a>
                  </li>
                  <li>
                    <a
                      href={`/${params.intent}/${cityMetadata.state.toLowerCase()}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {definition.label} spots across {cityMetadata.stateName}
                    </a>
                  </li>
                  <li>
                    <a
                      href={`/least-crowded/${params.city}`}
                      className="underline-offset-2 hover:underline"
                    >
                      Less-crowded backups
                    </a>
                  </li>
                  <li>
                    <a
                      href={`/water-temp/${params.city}`}
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
