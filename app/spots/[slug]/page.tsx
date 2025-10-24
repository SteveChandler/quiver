import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  SURF_SPOT_SLUGS,
  getSpotBySlug,
  getCityBySlug,
  type SurfSpotSlug,
} from "@/lib/data/surf-spots";
import { buildPageMetadata } from "@/lib/seo/meta";
import { SpotStructuredData } from "@/components/seo/spot-structured-data";

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
  const spot = getSpotBySlug(params.slug);
  if (!spot) {
    return {};
  }

  const city = getCityBySlug(spot.citySlug);
  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
  }).format(now);

  const title = `${spot.name} Surf Report, Tides, Water Temp & Forecast (Today)`;
  const description = `Updated ${formattedDate}. Live ${spot.name} surf report for ${spot.region}: tides, water temperature, swell tips, wind strategy, and nearby alternatives powered by Quiver.`;

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

export default function SpotPage({ params }: SpotPageParams) {
  const spot = getSpotBySlug(params.slug);
  if (!spot) {
    return notFound();
  }
  const city = getCityBySlug(spot.citySlug);

  const now = new Date();
  const updatedAt = formatPacificDateTime(now);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const narrative = [
    spot.overview,
    spot.history,
    spot.conditions,
    `Tide insight: ${spot.tideAdvice}`,
    `Swell outlook: ${spot.swellAdvice}`,
    `Wind game plan: ${spot.windAdvice}`,
    `Water temperature watch: ${spot.waterTemp}`,
    `Crowd and safety notes: Expect a ${spot.crowdFactor.toLowerCase()} pack and keep an eye on ${spot.hazards.join(
      ", "
    )}. Rotate respectfully, call your waves, and plan an exit route before paddling out.`,
    `Parking and amenities: ${spot.parking}. Nearby support includes ${spot.amenities.join(
      ", "
    )}. Lock in a backup parking option so you can pivot fast when the lot reaches capacity.`,
  ];

  const quickFacts = [
    {
      label: "Best tide window",
      value: spot.tideAdvice,
    },
    {
      label: "Swell sweet spot",
      value: spot.swellAdvice,
    },
    {
      label: "Wind strategy",
      value: spot.windAdvice,
    },
    {
      label: "Water temperature",
      value: spot.waterTemp,
    },
  ];

  return (
    <div className="bg-white">
      <SpotStructuredData
        spot={spot}
        citySlug={spot.citySlug}
        baseUrl={baseUrl}
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
            {spot.region}
          </p>
          <p className="text-base text-slate-700">
            Track live swell, tide, and weather for{" "}
            <a
              className="font-semibold text-sky-700 underline-offset-2 hover:underline"
              href={`/ca/${spot.citySlug}`}
            >
              {city?.name} surf spots
            </a>{" "}
            and log your sessions in Quiver to see year-over-year progression.
          </p>
        </header>

        <div className="mt-10 grid gap-6 md:grid-cols-[2fr_1fr] md:gap-10">
          <article className="space-y-6 text-base leading-relaxed text-slate-800">
            {narrative.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

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
                  <div key={fact.label} className="rounded-lg bg-white p-3 shadow">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 text-sm text-slate-600">
                <p>
                  Hazards to watch: {spot.hazards.join(", ")}. Log the session in
                  your{" "}
                  <a
                    href="/app"
                    className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                  >
                    Quiver journal
                  </a>{" "}
                  to track how these variables impacted your surf.
                </p>
              </div>
            </div>

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
                    <p className="mt-2 text-sm text-slate-700">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Nearby alternatives
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Need a backup if the lot fills? Try these spots with similar
                conditions and check tide timing before you switch.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-sky-700">
                {spot.nearby.map((slug) => {
                  const nearbySpot = getSpotBySlug(slug as SurfSpotSlug);
                  if (!nearbySpot) return null;
                  return (
                    <li key={slug}>
                      <a
                        href={`/spots/${nearbySpot.slug}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {nearbySpot.name} tide chart
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>

            {spot.beginnerNotes ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-inner">
                <h2 className="text-lg font-semibold text-slate-900">
                  Beginner notes
                </h2>
                <p className="mt-2 text-sm text-slate-700">
                  {spot.beginnerNotes}
                </p>
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
              </div>
            ) : (
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
            )}

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
          </aside>
        </div>
      </section>
    </div>
  );
}
