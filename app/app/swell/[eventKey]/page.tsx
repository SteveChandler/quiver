import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactElement } from "react";

import { getFirstTouchPlatform } from "@/lib/analytics/web-context";
import {
  buildSwellAppUrl,
  buildSwellCardView,
  buildSwellImagePath,
  buildSwellShareUrl,
  describeSwellHistory,
  loadSwellShareEvent,
  parseSwellKind,
  parseSwellTitleId,
  type SwellCardView,
  type SwellKind,
  type SwellShareEvent,
} from "@/lib/share/swell-share";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { SwellShareCta } from "./swell-share-cta";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SwellSharePageProps {
  params: Promise<{ eventKey: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

const METADATA_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.quiversurf.app";

const GENERIC_SHARE_URL = "https://www.quiversurf.app/app";

function absoluteUrl(path: string): string {
  try {
    return new URL(path, METADATA_BASE_URL).toString();
  } catch {
    return path;
  }
}

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface ResolvedSwellShare {
  event: SwellShareEvent | null;
  kind: SwellKind;
  view: SwellCardView;
}

async function resolveSwellShare({
  params,
  searchParams,
}: SwellSharePageProps): Promise<ResolvedSwellShare> {
  const { eventKey } = await params;
  const query = (await searchParams) ?? {};
  const kind = parseSwellKind(firstSearchValue(query.k));
  let event: SwellShareEvent | null = null;
  try {
    event = await loadSwellShareEvent(createSupabaseServiceRoleClient(), eventKey);
  } catch (error) {
    // An unreadable event still gets the generic card and the install funnel.
    console.error("[app/swell] Failed to load swell event:", error);
  }
  const view = buildSwellCardView({
    event,
    kind,
    titleId: parseSwellTitleId(firstSearchValue(query.t)),
  });
  return { event, kind, view };
}

function describeCard(view: SwellCardView): string {
  if (view.generic) {
    return "Quiver tells you when swell is headed for your beach. Free to start.";
  }
  const [size, period, when] = view.stats;
  return `${view.beachName}: ${size.value} ${size.unit} at ${period.value}${period.unit}, ${when.value} ${when.unit}. The full forecast is in Quiver.`;
}

export async function generateMetadata(props: SwellSharePageProps): Promise<Metadata> {
  const { event, kind, view } = await resolveSwellShare(props);
  const title = view.generic ? "Swell alert" : view.headline;
  const description = describeCard(view);
  const ogImage = absoluteUrl(
    buildSwellImagePath(event?.payload.eventKey ?? null, kind, view.titleId, "og"),
  );

  return {
    title,
    description,
    robots: NOINDEX_ROBOTS,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Quiver",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

function SwellCard({ view }: { view: SwellCardView }): ReactElement {
  return (
    <article className="rounded-2xl border-4 border-[#11100D] bg-[#F5EEDC] p-6 text-[#11100D] shadow-xl shadow-black/30 sm:p-8">
      <p
        className={`inline-block px-3 py-1 font-heading text-sm font-black uppercase tracking-[0.12em] ${
          view.generic ? "bg-[#11100D] text-[#F5EEDC]" : "bg-[#F78E42] text-[#11100D]"
        }`}
      >
        {view.beachName}
      </p>
      <h1 className="mt-5 font-heading text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl">
        {view.headline}
      </h1>
      {view.stats.length > 0 ? (
        <dl className="mt-8 grid grid-cols-3 gap-4 border-t-4 border-[#11100D] pt-4">
          {view.stats.map((stat) => (
            <div key={stat.label}>
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#11100D]/65">
                {stat.label}
              </dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5 font-heading font-black leading-none">
                <span className="text-5xl sm:text-6xl">{stat.value}</span>
                <span className="whitespace-nowrap text-base sm:text-lg">{stat.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-6 font-heading text-sm font-black tracking-[0.3em]">QUIVER</p>
    </article>
  );
}

function teaser(event: SwellShareEvent | null): string {
  if (!event) {
    return "Quiver watches the forecast for your beach and tells you when swell is on the way. Free to start.";
  }
  if (event.payload.status === "passed" || event.payload.status === "dropped") {
    return "Quiver tells you about the next one before your friends do. Free to start.";
  }
  return `The hour-by-hour for ${event.payload.beach.name}, with wind and tide, is in the app. Free to start.`;
}

export default async function SwellSharePage(
  props: SwellSharePageProps,
): Promise<ReactElement> {
  const { event, kind, view } = await resolveSwellShare(props);
  const requestHeaders = await headers();
  const platform = getFirstTouchPlatform(requestHeaders.get("user-agent") ?? "");
  const eventKey = event?.payload.eventKey ?? null;

  return (
    <main className="min-h-screen bg-[#101436] px-5 py-8 text-white sm:px-8 sm:py-12">
      <section className="mx-auto flex max-w-xl flex-col gap-6">
        <SwellCard view={view} />
        {event ? (
          <p className="text-base font-semibold leading-6 text-[#B8C7E0]">
            {describeSwellHistory(event)}
          </p>
        ) : null}
        <SwellShareCta
          platform={platform}
          kind={kind}
          eventKey={eventKey}
          appUrl={eventKey ? buildSwellAppUrl(eventKey, kind, view.titleId) : null}
          shareUrl={
            eventKey ? buildSwellShareUrl(eventKey, kind, view.titleId) : GENERIC_SHARE_URL
          }
        />
        <p className="text-sm font-semibold leading-6 text-[#91A0C8]">{teaser(event)}</p>
      </section>
    </main>
  );
}
