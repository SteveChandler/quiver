import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import {
  SURF_CITY_SLUGS,
  SURF_INTENTS,
  getCityBySlug,
  getSpotsForCity,
  getSpotsForIntent,
  type SurfCitySlug,
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
  return SURF_CITY_SLUGS.map((city) => ({ city }));
}

interface CityPageParams {
  params: { city: SurfCitySlug };
}

export async function generateMetadata({
  params,
}: CityPageParams): Promise<Metadata> {
  const city = getCityBySlug(params.city);
  if (!city) return {};

  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
  }).format(now);

  const title = `${city.name} Surf Reports, Tides & Forecast | Quiver`;
  const description = `Updated ${formattedDate}. Plan ${city.name} surf sessions with live tide intel, featured breaks, beginner zones, and less-crowded backups across ${city.regionLabel}.`;

  return buildPageMetadata({
    title,
    description,
    path: `/ca/${city.slug}`,
    keywords: [
      `${city.name} surf report`,
      `${city.name} surf forecast`,
      `${city.name} tides`,
      `${city.name} water temperature`,
      "Southern California surf guide",
    ],
  });
}

export default function CityPage({ params }: CityPageParams) {
  const city = getCityBySlug(params.city);
  if (!city) {
    return notFound();
  }

  const spots = getSpotsForCity(city.slug);
  const now = new Date();
  const updatedAt = formatPacificDateTime(now);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const featuredIntents = city.featuredIntents.map((intent) => ({
    intent,
    definition: SURF_INTENTS[intent],
    spots: getSpotsForIntent(city.slug, intent).slice(0, 4),
  }));

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${baseUrl.replace(/\/$/, "")}/` },
          {
            name: `${city.name} Surf`,
            url: `${baseUrl.replace(/\/$/, "")}/ca/${city.slug}`,
          },
        ]}
      />
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
            {city.regionLabel}
          </p>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-5xl">
            {city.name} surf forecast, tides, and planning guide
          </h1>
          <p className="text-base text-slate-700">
            Updated {updatedAt} PT · Forecast windows refresh every 30 minutes
            with Quiver&apos;s buoy blend.
          </p>
          <p className="text-base text-slate-700">
            Use this hub to move from dawn patrol scouting to an evening{" "}
            <Link
              href="/app"
              className="font-semibold text-sky-700 underline-offset-2 hover:underline"
            >
              session log
            </Link>
            . We surface tide swings, alternative peaks, and intent-based guides
            so you pivot faster than the crowd.
          </p>
        </header>

        <article className="mt-10 grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-16">
          <div className="space-y-8 text-base leading-relaxed text-slate-800">
            {city.description.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p>
              Today&apos;s playbook: set alerts for the morning low tide, grab a
              coffee near the lot, and keep an eye on wind reversals after 10
              a.m. Quiver tracks hourly condition changes so you can decide
              whether to stay local or hop up the coast toward{" "}
              <a
                href={`/spots/${city.topSpots[0]}`}
                className="font-semibold text-sky-700 underline-offset-2 hover:underline"
              >
                {spots.find((s) => s.slug === city.topSpots[0])?.name ?? "the top spot"}
              </a>
              .
            </p>
            <p>
              Weekend outlook: pair the incoming tide push with a backup parking
              plan. If the headline reef is shoulder-to-shoulder, slide to the
              secondary peak listed below or jump into the{" "}
              <a
                href={`/least-crowded/${city.slug}`}
                className="font-semibold text-sky-700 underline-offset-2 hover:underline"
              >
                less-crowded guide
              </a>{" "}
              for real-time alternates.
            </p>
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Quick navigation
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-sky-700">
                {city.quickLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="underline-offset-2 hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-inner">
              <h2 className="text-lg font-semibold text-slate-900">
                Planning checklist
              </h2>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                <li>Refresh buoy readings before dawn to confirm swell angle.</li>
                <li>
                  Screenshot tide windows and share with your crew inside Quiver
                  chat.
                </li>
                <li>
                  Log the session afterward to tag crowd levels, wave quality,
                  and board choice.
                </li>
              </ul>
            </div>
          </aside>
        </article>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-slate-900">
            Featured {city.name} surf spots
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Start with these proven peaks, then explore the full map for 25+
            Southern California breaks we update daily.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {city.topSpots.slice(0, 8).map((slug) => {
              const spot = spots.find((s) => s.slug === slug);
              if (!spot) return null;
              return (
                <a
                  key={slug}
                  href={`/spots/${spot.slug}`}
                  className="group block rounded-xl border border-slate-200 p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 group-hover:text-sky-700">
                      {spot.name}
                    </h3>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {spot.skillLevel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{spot.overview}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Best tide: {spot.tideAdvice}
                  </p>
                </a>
              );
            })}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-slate-900">
            Session timing modules
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Today",
                summary:
                  "Track marine layer burn-off and watch the tide flip around mid-morning. Use the crowd meter in Quiver to find gaps between surf school lessons.",
              },
              {
                title: "Now",
                summary:
                  "Check live wind before you paddle. Kelp-protected reefs hold shape longer, while open beachbreaks favor lighter boards once the breeze arrives.",
              },
              {
                title: "Weekend",
                summary:
                  "Pair the rising morning tides with combo swells for longer rides. If the main peak is slammed, drive five minutes to the alternates listed above.",
              },
            ].map((module) => (
              <div
                key={module.title}
                className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-inner"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  {module.title}
                </h3>
                <p className="mt-2 text-sm text-slate-700">{module.summary}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 space-y-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Guides by intent
          </h2>
          <p className="text-sm text-slate-600">
            Choose the objective that matches your session and we&apos;ll filter
            the best peaks—perfect for beginner foamies, emptier lineups, tide
            hunters, or water temperature research.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {featuredIntents.map(({ intent, definition, spots: intentSpots }) => (
              <div
                key={intent}
                className="rounded-xl border border-slate-200 p-5 shadow-sm"
              >
                <h3 className="text-xl font-semibold text-slate-900">
                  {definition.heading({ cityName: city.name })}
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  {definition.intro({ cityName: city.name })}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-sky-700">
                  {intentSpots.map((spot) => (
                    <li key={spot.slug}>
                      <a
                        href={`/${intent}/${city.slug}#${spot.slug}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {spot.name}
                      </a>
                    </li>
                  ))}
                </ul>
                <a
                  href={`/${intent}/${city.slug}`}
                  className="mt-4 inline-flex text-sm font-semibold text-sky-700 underline-offset-2 hover:underline"
                >
                  View the full {definition.label.toLowerCase()} playbook
                </a>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
