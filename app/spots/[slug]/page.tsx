import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import {
  SURF_SPOT_SLUGS,
  type SurfSpotSlug,
  type SurfCitySlug,
} from "@/lib/data/surf-spots";
import { buildPageMetadata, buildDynamicBeachMetadata } from "@/lib/seo/meta";
import { buildBeachUrl, getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { getBeachForecastPreview } from "@/actions/forecast-actions";
import { getIntentSlug } from "@/lib/utils/slug-helpers";
import { SpotStructuredData } from "@/components/seo/spot-structured-data";
import {
  getSpotDataBySlug,
  getSpotFeaturedPhoto,
} from "@/actions/spot/spot-data-actions";
import {
  SpotHeroSection,
  SpotLocationMap,
  SpotPhotoGallery,
  SpotSurfReportStream,
} from "@/components/spots";

export const revalidate = 3600;

function formatPacificDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export async function generateStaticParams() {
  return SURF_SPOT_SLUGS.map((slug) => ({ slug }));
}

interface SpotPageParams {
  params: Promise<{ slug: SurfSpotSlug }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: SpotPageParams): Promise<Metadata> {
  const params = await props.params;
  const { data: spot, dbHasLocation } = await getSpotDataBySlug(params.slug);
  if (!spot) {
    return {};
  }

  const cityName = spot.city || spot.region?.split(",")[0] || "Southern California";
  const regionName = spot.region?.split(",")[0] || "";

  // Fetch live forecast data for dynamic meta
  let forecastData: { wave_height?: string | null } | null = null;
  if (spot.id) {
    const forecastResult = await getBeachForecastPreview(spot.id);
    if (forecastResult.success && forecastResult.data?.wave_height) {
      forecastData = { wave_height: forecastResult.data.wave_height };
    }
  }

  // Use CTR-optimized dynamic metadata (same as hierarchical pages)
  // SpotPageData uses camelCase (breakType, skillLevel) and lacks wave_tips,
  // crowd_level, average_rating, review_count — those fields yield undefined (safe fallthrough)
  const { title, description } = buildDynamicBeachMetadata({
    beach: {
      name: spot.name,
      city: spot.city,
      state: spot.state || regionName,
      break_type: spot.breakType ?? null,
      skill_level: spot.skillLevel || null,
      description_excerpt: spot.description
        ? (spot.description.split(/\.(\s|$)/)[0] + ".").trim() || null
        : null,
      wave_tips: (spot as any).wave_tips ?? null,
      crowd_level: (spot as any).crowd_level ?? null,
      average_rating: (spot as any).average_rating ?? null,
      review_count: (spot as any).review_count ?? null,
    },
    forecast: forecastData,
  });

  // Canonical path matches sitemap logic:
  // - Use hierarchical URL when DB has complete location data
  // - Fall back to /spots/{slug} when location data is incomplete
  // Note: dbHasLocation guarantees non-empty city and state in the DB record
  const canonicalPath = dbHasLocation && spot.slug
    ? buildBeachUrl({ slug: spot.slug, city: spot.city!, state: spot.state! })
    : `/spots/${spot.slug}`;

  return buildPageMetadata({
    title,
    description,
    path: canonicalPath,
    image: `/api/og/beach?slug=${params.slug}`,
    keywords: [
      `${spot.name} surf report`,
      `${spot.name} surf forecast`,
      `${spot.name} surf conditions`,
      `${spot.name} tides`,
      `${spot.name} wave height`,
      `${cityName} surf`,
      `${cityName} surf report`,
      `${regionName} surf spots`,
      "surf report",
      "surf forecast",
      "surf conditions",
      "wave height today",
    ].filter(Boolean),
  });
}

export default async function SpotPage(props: SpotPageParams) {
  const params = await props.params;
  const { data: spot, dbHasLocation } = await getSpotDataBySlug(params.slug);
  if (!spot) {
    return notFound();
  }

  // Canonical redirect is handled by middleware (HTTP 301) for beaches with complete
  // location data in the DB. If the middleware DB lookup timed out or failed, this page
  // renders normally at /spots/{slug} — the generateMetadata canonical still points to
  // the hierarchical URL, so crawlers receive the correct canonical signal.
  // See: middleware.ts — /spots/{slug} intercept block.

  // Get city name from spot data (database-driven)
  const cityName = spot.city || spot.region?.split(",")[0] || "Southern California";

  // Construct minimal Beach object for surf report streaming
  const beachForReport = spot.id && spot.latitude && spot.longitude
    ? {
        id: spot.id,
        lat: spot.latitude,
        lon: spot.longitude,
        name: spot.name,
        break_type: null,
        wind_offshore_deg: null,
      } as any
    : null;

  // Fetch featured photo if we have a beach ID
  const featuredPhoto = spot.id ? await getSpotFeaturedPhoto(spot.id) : null;

  const now = new Date();
  const updatedAt = formatPacificDateTime(now);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Build narrative paragraphs from available content
  const narrative: string[] = [];
  if (spot.overview) narrative.push(spot.overview);
  if (spot.history) narrative.push(spot.history);
  if (spot.conditions) narrative.push(spot.conditions);
  if (spot.tideAdvice) narrative.push(`Tide insight: ${spot.tideAdvice}`);
  if (spot.swellAdvice) narrative.push(`Swell outlook: ${spot.swellAdvice}`);
  if (spot.windAdvice) narrative.push(`Wind game plan: ${spot.windAdvice}`);
  if (spot.waterTemp)
    narrative.push(`Water temperature watch: ${spot.waterTemp}`);
  if (spot.crowdFactor && spot.hazards) {
    narrative.push(
      `Crowd and safety notes: Expect a ${spot.crowdFactor.toLowerCase()} pack and keep an eye on ${spot.hazards.join(
        ", "
      )}. Rotate respectfully, call your waves, and plan an exit route before paddling out.`
    );
  }
  if (spot.parking && spot.amenities) {
    narrative.push(
      `Parking and amenities: ${
        spot.parking
      }. Nearby support includes ${spot.amenities.join(
        ", "
      )}. Lock in a backup parking option so you can pivot fast when the lot reaches capacity.`
    );
  }

  const quickFacts = [
    spot.tideAdvice && { label: "Best tide window", value: spot.tideAdvice },
    spot.swellAdvice && { label: "Swell sweet spot", value: spot.swellAdvice },
    spot.windAdvice && { label: "Wind strategy", value: spot.windAdvice },
    spot.waterTemp && { label: "Water temperature", value: spot.waterTemp },
  ].filter(Boolean) as { label: string; value: string }[];

  // Get nearby spots data
  const nearbySpotData = spot.nearby
    ? await Promise.all(
        spot.nearby.map(async (slug) => {
          const { data: nearbySpot } = await getSpotDataBySlug(slug);
          return nearbySpot;
        })
      )
    : [];
  const validNearbySpots = nearbySpotData.filter(Boolean);

  return (
    <div className="bg-white">
      <SpotStructuredData
        spot={{
          slug: spot.slug,
          name: spot.name,
          coordinates: {
            lat: spot.latitude || 0,
            lon: spot.longitude || 0,
          },
          speakableSummary: spot.speakableSummary || spot.overview || "",
          faq: spot.faq || [],
          citySlug: spot.citySlug || ("san-diego" as SurfCitySlug),
          region: spot.region || "",
          overview: spot.overview || "",
          history: spot.history || "",
          conditions: spot.conditions || "",
          tideAdvice: spot.tideAdvice || "",
          swellAdvice: spot.swellAdvice || "",
          windAdvice: spot.windAdvice || "",
          waterTemp: spot.waterTemp || "",
          hazards: spot.hazards || [],
          skillLevel: (spot.skillLevel as any) || "Intermediate",
          bestSeason: spot.bestSeason || "",
          crowdFactor: spot.crowdFactor || "Moderate",
          parking: spot.parking || "",
          amenities: spot.amenities || [],
          nearby: spot.nearby || [],
          intentTags: (spot.intentTags as any) || [],
        }}
        cityName={cityName}
        citySlug={spot.citySlug || undefined}
        baseUrl={baseUrl}
      />

      {/* Above-the-fold surf report (streams via Suspense) */}
      {beachForReport && (
        <SpotSurfReportStream beach={beachForReport} />
      )}

      {/* Hero Section with Photo or Map */}
      <SpotHeroSection
        spotName={spot.name}
        latitude={spot.latitude}
        longitude={spot.longitude}
        featuredPhotoUrl={featuredPhoto?.imageUrl || null}
        attribution={featuredPhoto?.attributionHtml}
      />

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
            Live surf intel
          </p>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            {spot.name} surf report and forecast
          </h1>
          <p className="js-daily-summary text-base text-slate-700">
            Updated {updatedAt} PT · {cityName ?? "Southern California"} ·{" "}
            {spot.region || ""}
          </p>
          <p className="text-base text-slate-700">
            Track live swell, tide, and weather for{" "}
            {spot.citySlug ? (
              <a
                className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                href={`/beaches/usa/ca/${spot.citySlug}`}
              >
                {cityName} surf spots
              </a>
            ) : (
              "local surf spots"
            )}{" "}
            and log your sessions in Quiver to see year-over-year progression.
          </p>
        </header>

        <div className="mt-10 grid gap-6 md:grid-cols-[2fr_1fr] md:gap-10">
          <article className="space-y-6 text-base leading-relaxed text-slate-800">
            {narrative.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

            {quickFacts.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">
                  Session prep snapshot
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Save this checklist before you paddle out—update times refresh
                  hourly so you always see the latest intel.
                </p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {quickFacts.map((fact) => (
                    <div
                      key={fact.label}
                      className="rounded-lg bg-white p-3 shadow"
                    >
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {fact.label}
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {spot.hazards && spot.hazards.length > 0 && (
                  <div className="mt-4 text-sm text-slate-600">
                    <p>
                      Hazards to watch: {spot.hazards.join(", ")}. Log the
                      session in your{" "}
                      <Link
                        href="/app"
                        className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                      >
                        Quiver journal
                      </Link>{" "}
                      to track how these variables impacted your surf.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Photo Gallery Section */}
            {spot.id && (
              <SpotPhotoGallery beachId={spot.id} spotName={spot.name} />
            )}

            {spot.faq && spot.faq.length > 0 && (
              <section aria-labelledby="spot-faq">
                <h2
                  id="spot-faq"
                  className="text-xl font-semibold text-slate-900"
                >
                  {spot.name} FAQs
                </h2>
                <div className="mt-4 space-y-3">
                  {spot.faq.map((item) => (
                    <details
                      key={item.question}
                      className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200"
                    >
                      <summary className="cursor-pointer text-base font-medium text-slate-900 group-open:text-sky-700">
                        {item.question}
                      </summary>
                      <p className="mt-2 text-sm text-slate-700">
                        {item.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className="space-y-6">
            {/* Location Map */}
            {spot.latitude && spot.longitude && (
              <SpotLocationMap
                latitude={spot.latitude}
                longitude={spot.longitude}
                spotName={spot.name}
              />
            )}

            {validNearbySpots.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Nearby alternatives
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Need a backup if the lot fills? Try these spots with similar
                  conditions and check tide timing before you switch.
                </p>
                <ul className="mt-3 space-y-2 text-sm text-sky-700">
                  {validNearbySpots.map((nearbySpot) => (
                    <li key={nearbySpot!.slug}>
                      <a
                        href={getBeachHrefSafe(nearbySpot!) || `/spots/${nearbySpot!.slug}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {nearbySpot!.name} tide chart
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {spot.beginnerNotes ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-inner">
                <h2 className="text-lg font-semibold text-slate-900">
                  Beginner notes
                </h2>
                <p className="mt-2 text-sm text-slate-700">
                  {spot.beginnerNotes}
                </p>
                {spot.citySlug && (
                  <p className="mt-3 text-sm text-slate-600">
                    For more gentle peaks, explore{" "}
                    <a
                      href={`/beginner/${getIntentSlug(spot.citySlug, spot.state)}`}
                      className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                    >
                      beginner surf spots in {cityName ?? "this region"}
                    </a>
                    .
                  </p>
                )}
              </div>
            ) : spot.citySlug ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-inner">
                <h2 className="text-lg font-semibold text-slate-900">
                  Pivot plan
                </h2>
                <p className="text-sm text-slate-700">
                  Looking for fewer heads in the lineup? Check the{" "}
                  <a
                    href={`/least-crowded/${getIntentSlug(spot.citySlug, spot.state)}`}
                    className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                  >
                    less crowded {cityName ?? ""} surf guide
                  </a>{" "}
                  for tide windows and alternate peaks.
                </p>
              </div>
            ) : null}

            {spot.citySlug && (
              <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Weekend checklist
                </h2>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  <li>
                    Monitor{" "}
                    <a
                      href={`/tide/${getIntentSlug(spot.citySlug, spot.state)}`}
                      className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                    >
                      tide swings
                    </a>{" "}
                    two hours around your target session.
                  </li>
                  <li>
                    Check{" "}
                    <a
                      href={`/water-temp/${getIntentSlug(spot.citySlug, spot.state)}`}
                      className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                    >
                      water temps
                    </a>{" "}
                    to dial wetsuit choice.
                  </li>
                  <li>
                    Plan a{" "}
                    <a
                      href={`/dawn-patrol/${getIntentSlug(spot.citySlug, spot.state)}`}
                      className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                    >
                      dawn patrol
                    </a>{" "}
                    or{" "}
                    <a
                      href={`/sunset/${getIntentSlug(spot.citySlug, spot.state)}`}
                      className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                    >
                      sunset session
                    </a>{" "}
                    for glassier conditions.
                  </li>
                  <li>
                    Looking for mellow waves? Find{" "}
                    <a
                      href={`/longboard/${getIntentSlug(spot.citySlug, spot.state)}`}
                      className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                    >
                      longboard spots
                    </a>{" "}
                    nearby.
                  </li>
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
