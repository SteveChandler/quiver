import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import {
  SURF_SPOT_SLUGS,
  getCityBySlug,
  type SurfSpotSlug,
  type SurfCitySlug,
} from "@/lib/data/surf-spots";
import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { SpotStructuredData } from "@/components/seo/spot-structured-data";
import {
  getSpotDataBySlug,
  getSpotFeaturedPhoto,
} from "@/actions/spot/spot-data-actions";
import {
  SpotHeroSection,
  SpotLocationMap,
  SpotPhotoGallery,
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
  params: { slug: SurfSpotSlug };
}

export async function generateMetadata({
  params,
}: SpotPageParams): Promise<Metadata> {
  const spot = await getSpotDataBySlug(params.slug);
  if (!spot) {
    return {};
  }

  const city = spot.citySlug ? getCityBySlug(spot.citySlug) : null;
  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
  }).format(now);

  const title = `${spot.name} Surf Report, Tides, Water Temp & Forecast (Today)`;
  const description = `Updated ${formattedDate}. Live ${
    spot.name
  } surf report for ${
    spot.region || "Southern California"
  }: tides, water temperature, swell tips, wind strategy, and nearby alternatives powered by Quiver.`;

  return buildPageMetadata({
    title,
    description,
    path: `/spots/${spot.slug}`,
    keywords: [
      `${spot.name} surf report`,
      `${spot.name} tides`,
      `${spot.name} water temperature`,
      `${spot.name} forecast`,
      `${city?.name ?? "San Diego"} surf`,
      "Quiver surf reports",
    ],
  });
}

export default async function SpotPage({ params }: SpotPageParams) {
  const spot = await getSpotDataBySlug(params.slug);
  if (!spot) {
    return notFound();
  }

  // 301 Redirect to canonical URL if possible
  // This consolidates legacy /spots/[slug] URLs to the new hierarchical structure
  if (spot.slug && spot.city && spot.state) {
    const canonicalUrl = buildBeachUrl({
      slug: spot.slug,
      city: spot.city,
      state: spot.state,
    });
    permanentRedirect(canonicalUrl);
  }

  const city = spot.citySlug ? getCityBySlug(spot.citySlug) : null;

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
          const nearbySpot = await getSpotDataBySlug(slug);
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
            lng: spot.longitude || 0,
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
        citySlug={spot.citySlug || ("san-diego" as SurfCitySlug)}
        baseUrl={baseUrl}
      />

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
            Updated {updatedAt} PT · {city?.name ?? "Southern California"} ·{" "}
            {spot.region || ""}
          </p>
          <p className="text-base text-slate-700">
            Track live swell, tide, and weather for{" "}
            {spot.citySlug ? (
              <a
                className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                href={`/ca/${spot.citySlug}`}
              >
                {city?.name} surf spots
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
                        href={`/spots/${nearbySpot!.slug}`}
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
                      href={`/beginner/${spot.citySlug}`}
                      className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                    >
                      beginner surf spots in {city?.name ?? "this region"}
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
                    href={`/least-crowded/${spot.citySlug}`}
                    className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                  >
                    less crowded {city?.name ?? ""} surf guide
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
                      href={`/tide/${spot.citySlug}`}
                      className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                    >
                      tide swings
                    </a>{" "}
                    two hours around your target session.
                  </li>
                  <li>
                    Refresh water-temp trends before dawn patrol to dial wetsuit
                    choice.
                  </li>
                  <li>
                    Log waves in Quiver after each session to build a personal
                    spot encyclopedia.
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
