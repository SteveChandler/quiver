import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ExternalLink, Smartphone, Waves } from "lucide-react";

import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";
import {
  isCanonicalHandoffId,
  parseHandoffContext,
} from "@/lib/beach-follow/handoff";
import { BFR_PAGE_TYPES } from "@/lib/analytics/event-taxonomy";
import { loadForecastWindowShareMetadata } from "@/lib/share/forecast-window-share";
import { ShareLinkOpenTracker } from "./share-link-open-tracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface AppSpotHandoffPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

const METADATA_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.quiversurf.app";

function absoluteUrl(path: string): string {
  try {
    return new URL(path, METADATA_BASE_URL).toString();
  } catch {
    return path;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: AppSpotHandoffPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const windowId = firstSearchValue(resolvedSearchParams.window);
  const shareMetadata = await loadForecastWindowShareMetadata({
    slug,
    window: windowId,
  });
  const ogImage = absoluteUrl(shareMetadata.ogImagePath);

  return {
    title: shareMetadata.title,
    description: shareMetadata.description,
    robots: NOINDEX_ROBOTS,
    openGraph: {
      title: shareMetadata.title,
      description: shareMetadata.description,
      type: "website",
      siteName: "Quiver",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: shareMetadata.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: shareMetadata.title,
      description: shareMetadata.description,
      images: [ogImage],
    },
  };
}

function firstSearchValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeDecodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function buildBeachFallbackPath(slug: string): string {
  return `/beach/${encodeURIComponent(safeDecodeSlug(slug))}`;
}

function buildExactRetryPath(
  slug: string,
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const handoffId = firstSearchValue(searchParams.handoff_id)?.toLowerCase();
  const serializedContext = firstSearchValue(searchParams.context);
  const surface = firstSearchValue(searchParams.surface);
  if (
    !isCanonicalHandoffId(handoffId) ||
    firstSearchValue(searchParams.source) !== "exact_call" ||
    firstSearchValue(searchParams.placement) !== "exact_call" ||
    firstSearchValue(searchParams.handoff_context) !== "exact_call" ||
    !serializedContext ||
    !surface || !BFR_PAGE_TYPES.includes(surface as (typeof BFR_PAGE_TYPES)[number])
  ) {
    return null;
  }
  const parsed = parseHandoffContext(serializedContext);
  if (
    !parsed.ok ||
    parsed.context.slug !== safeDecodeSlug(slug) ||
    parsed.context.windowId !== firstSearchValue(searchParams.window)
  ) {
    return null;
  }

  const query = new URLSearchParams({
    window: parsed.context.windowId,
    handoff_id: handoffId,
    source: "exact_call",
    surface,
    placement: "exact_call",
    handoff_context: "exact_call",
    context: serializedContext,
  });
  return `/app/spot/${encodeURIComponent(safeDecodeSlug(slug))}?${query.toString()}`;
}

export default async function AppSpotHandoffPage({
  params,
  searchParams,
}: AppSpotHandoffPageProps): Promise<ReactElement> {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const windowId = firstSearchValue(resolvedSearchParams.window);
  const shareMetadata = await loadForecastWindowShareMetadata({
    slug,
    window: windowId,
  });
  const webFallbackHref = buildBeachFallbackPath(slug);
  const exactRetryHref = buildExactRetryPath(slug, resolvedSearchParams);
  const hasPositiveWindow = !shareMetadata.isFallback;
  const displayWindowLabel = hasPositiveWindow
    ? shareMetadata.windowLabel
    : null;

  return (
    <main className="min-h-screen bg-[#101436] px-5 py-12 text-white sm:px-8">
      <ShareLinkOpenTracker
        slug={safeDecodeSlug(slug)}
        windowValue={windowId ?? null}
      />
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl flex-col justify-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-md bg-[#F78E42] text-[#11100D] shadow-lg shadow-black/25">
          <Waves className="h-7 w-7" aria-hidden="true" />
        </div>

        <p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-[#FDB84B]">
          Quiver surf window
        </p>
        <h1 className="font-heading text-4xl font-black leading-tight text-white sm:text-5xl">
          {hasPositiveWindow
            ? `${shareMetadata.beachName} is ready in Quiver.`
            : "Check current surf conditions in Quiver."}
        </h1>
        {displayWindowLabel ? (
          <p className="mt-4 text-base font-semibold text-[#B8C7E0]">
            Window: <span className="text-white">{displayWindowLabel}</span>
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {exactRetryHref ? (
            <a
              href={exactRetryHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F78E42] px-5 py-3 text-base font-black text-[#11100D] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101436]"
            >
              <Smartphone className="h-5 w-5" aria-hidden="true" />
              Open this exact call in Quiver
            </a>
          ) : null}
          <a
            href={IOS_APP_STORE_WEB_REDIRECT_PATH}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 py-3 text-base font-black text-white transition hover:border-[#7BDCB5]/60 hover:bg-[#7BDCB5]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7BDCB5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101436]"
          >
            <Smartphone className="h-5 w-5" aria-hidden="true" />
            Open in the App Store
          </a>
          <a
            href={webFallbackHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 py-3 text-base font-black text-white transition hover:border-[#7BDCB5]/60 hover:bg-[#7BDCB5]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7BDCB5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101436]"
          >
            Continue on web
            <ExternalLink className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>

        <p className="mt-6 max-w-xl text-sm font-semibold leading-6 text-[#91A0C8]">
          Open Quiver from the App Store, or keep reading this spot forecast on
          the web.
        </p>
      </section>
    </main>
  );
}
