import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import {
  SURF_INTENTS,
  type SurfIntentSlug,
} from "@/lib/constants/surf-intents";
import { INTENT_DEFINITIONS } from "@/lib/constants/intent-definitions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";
import { StateMapView } from "@/components/state/state-map-view";
import {
  isValidStateSlug,
  getUsStateDisplayNameFromSlug,
} from "@/lib/utils/beach-url-utils";
import { getBeachesByIntentAndState } from "@/actions/beach/beach-query-actions";

export const revalidate = 1800;

const INTENT_SLUGS: SurfIntentSlug[] = [
  "beginner",
  "least-crowded",
  "tide",
  "water-temp",
  "longboard",
  "dawn-patrol",
  "sunset",
];

// Valid US state slugs for static generation
const US_STATE_SLUGS = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md",
  "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc",
  "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
];

export async function generateStaticParams() {
  const params: Array<{ intent: string; state: string }> = [];

  // Generate all intent × state combinations
  for (const state of US_STATE_SLUGS) {
    for (const intent of INTENT_SLUGS) {
      params.push({ intent, state });
    }
  }

  return params;
}

interface StateIntentPageParams {
  params: Promise<{ intent: string; state: string }>;
}

export async function generateMetadata({
  params,
}: StateIntentPageParams): Promise<Metadata> {
  const { intent, state } = await params;

  // Validate intent and state
  if (!isValidStateSlug(state)) return {};
  const definition = SURF_INTENTS[intent as SurfIntentSlug];
  if (!definition) return {};

  const stateName = getUsStateDisplayNameFromSlug(state);
  return buildPageMetadata({
    title: `${definition.label} Spots in ${stateName}`,
    description: `Find the best ${definition.label.toLowerCase()} surf spots across ${stateName}. AI-powered recommendations for every skill level.`,
    path: `/${intent}/${state}`,
  });
}

export default async function StateIntentPage({ params }: StateIntentPageParams) {
  const { intent, state } = await params;

  // Validate intent
  const definition = SURF_INTENTS[intent as SurfIntentSlug];
  if (!definition) {
    notFound();
  }

  // Validate state
  if (!isValidStateSlug(state)) {
    notFound();
  }

  const stateName = getUsStateDisplayNameFromSlug(state);

  // Fetch beaches for this intent and state
  const beachesResult = await getBeachesByIntentAndState(intent, state);

  const beaches = beachesResult.success && beachesResult.data ? beachesResult.data : [];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: `${stateName} Surf`, url: `${baseUrl}/beaches/usa/${state}` },
          { name: definition.label, url: `${baseUrl}/${intent}/${state}` },
        ]}
      />
      <FAQSchema
        items={generateIntentFAQ(
          intent as SurfIntentSlug,
          stateName,
          beaches.slice(0, 3).map((b) => b.name)
        )}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            {definition.heading({ cityName: stateName })}
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            {beaches.length} spots across {stateName}
          </p>
          <p className="text-base text-slate-700 mt-4">
            {definition.intro({ cityName: stateName })}
          </p>
        </header>

        {beaches.length === 0 ? (
          <section className="mb-8">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                No {definition.label.toLowerCase()} spots found in {stateName}
              </h2>
              <p className="text-slate-600 mb-4">
                We&apos;re expanding our coverage. Explore other regions or browse all surf spots.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/map" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ocean-blue transition-colors">
                  Explore the Map
                </Link>
                <Link href={`/beaches/usa/${state}`} className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                  All {stateName} Beaches
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Map Section */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                {definition.label} spots in {stateName}
              </h2>
              <StateMapView
                beaches={beaches}
                ariaLabel={`${definition.label} spots in ${stateName}`}
              />
            </section>

            {/* Focus Points */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                What to focus on
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
          </>
        )}
      </div>
    </div>
  );
}
