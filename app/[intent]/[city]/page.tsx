import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  SURF_CITY_SLUGS,
  SURF_INTENTS,
  type SurfCitySlug,
  type SurfIntentSlug,
  getCityBySlug,
  getSpotsForIntent,
} from "@/lib/data/surf-spots";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";

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
  params: { intent: SurfIntentSlug; city: SurfCitySlug };
}

export async function generateMetadata({
  params,
}: IntentPageParams): Promise<Metadata> {
  const city = getCityBySlug(params.city);
  const definition = SURF_INTENTS[params.intent];
  if (!city || !definition) return {};

  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
  }).format(now);

  const title = definition.titleTemplate({ cityName: city.name });
  const topSpotNames = getSpotsForIntent(city.slug, params.intent)
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

export default function IntentPage({ params }: IntentPageParams) {
  const city = getCityBySlug(params.city);
  const definition = SURF_INTENTS[params.intent];

  if (!city || !definition) {
    return notFound();
  }

  const spots = getSpotsForIntent(city.slug, params.intent);
  if (spots.length === 0) {
    return notFound();
  }

  const now = new Date();
  const updatedAt = formatPacificDateTime(now);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${baseUrl.replace(/\/$/, "")}/` },
          {
            name: `${city.name} Surf`,
            url: `${baseUrl.replace(/\/$/, "")}/ca/${city.slug}`,
          },
          {
            name: definition.label,
            url: `${baseUrl.replace(/\/$/, "")}/${params.intent}/${city.slug}`,
          },
        ]}
      />
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
            {city.name} · {definition.label}
          </p>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-5xl">
            {definition.heading({ cityName: city.name })}
          </h1>
          <p className="text-base text-slate-700">
            Updated {updatedAt} PT · Dialed recommendations refresh every 30
            minutes based on tide, wind, and crowd telemetry from Quiver.
          </p>
          <p className="text-base text-slate-700">
            {definition.intro({ cityName: city.name })} We pair it with live
            data so you can decide whether to stay put, scoot north up the
            freeway, or log a sunset session after work.
          </p>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-16">
          <article className="space-y-8 text-base leading-relaxed text-slate-800">
            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                What to focus on today
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
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

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                Top spot recommendations
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Sort your quiver, choose the right tide window, and jot down a
                backup in case the main peak gets stacked.
              </p>
              <div className="mt-4 space-y-5">
                {spots.map((spot) => (
                  <div
                    key={spot.slug}
                    id={spot.slug}
                    className="rounded-xl border border-slate-200 p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <a
                        href={`/spots/${spot.slug}`}
                        className="text-xl font-semibold text-slate-900 underline-offset-2 hover:text-sky-700 hover:underline"
                      >
                        {spot.name}
                      </a>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {spot.skillLevel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {spot.conditions}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <p className="font-semibold uppercase tracking-wide text-slate-500">
                          Tide cue
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {spot.tideAdvice}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <p className="font-semibold uppercase tracking-wide text-slate-500">
                          Swell blend
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {spot.swellAdvice}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <p className="font-semibold uppercase tracking-wide text-slate-500">
                          Wind plan
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {spot.windAdvice}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Hazards: {spot.hazards.join(", ")} · Crowd level:{" "}
                      {spot.crowdFactor}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                Session logging tips
              </h2>
              <p>
                Once you wrap the surf, drop a note in your Quiver journal with
                tide, board, and crowd observations. Over time you&apos;ll see
                crystal-clear patterns about when {city.name} rewards this type
                of session objective.
              </p>
            </section>
          </article>

          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-inner">
              <h2 className="text-lg font-semibold text-slate-900">
                Rapid-fire checklist
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Screenshot the tide window and share it with your crew.</li>
                <li>Pack the board that matches the fastest section above.</li>
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
                    href={`/ca/${city.slug}`}
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
      </section>
    </div>
  );
}
