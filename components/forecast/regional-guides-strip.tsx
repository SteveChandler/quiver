/**
 * Regional Guides Strip (server component)
 *
 * Replaces the uniform 3×4 guide grid with an asymmetric, sticker-aesthetic
 * layout: one featured card (the active region's guide — or the top-scoring
 * region with a guide when the active region has none), photo-backed where
 * `summaries[slug].photoUrl` is available, with varied rotations and
 * asymmetric border-radius so the list reads hand-cut.
 *
 * @module components/forecast/regional-guides-strip
 */

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { RegionalForecastSummary } from "@/lib/utils/regional-forecast-utils";
import { getRegionalGuideSubtitle } from "@/lib/data/regional-guide-copy";

interface GuideLink {
  region: ForecastRegion;
  guideSlug: string;
}

interface RegionalGuidesStripProps {
  summaries: Record<string, RegionalForecastSummary>;
  activeRegionSlug: string;
  guideLinks: GuideLink[];
  variant?: "default" | "zine";
}

// Cycling sticker-aesthetic knobs. Indexing by card position keeps the
// SSR/CSR output stable and consistent across reloads.
const CARD_ROTATIONS = [
  "-rotate-[1.25deg]",
  "rotate-[1deg]",
  "-rotate-[0.5deg]",
  "rotate-[1.5deg]",
  "-rotate-[1.75deg]",
  "rotate-[0.75deg]",
  "-rotate-[1deg]",
  "rotate-[0.5deg]",
  "-rotate-[0.75deg]",
  "rotate-[1.25deg]",
  "-rotate-[0.5deg]",
  "rotate-[1.5deg]",
];

const CARD_SHAPES = [
  "rounded-[28px_10px_30px_12px]",
  "rounded-[12px_32px_12px_32px]",
  "rounded-[24px_8px_20px_24px]",
  "rounded-[16px_24px_32px_8px]",
  "rounded-[32px_12px_16px_28px]",
  "rounded-[20px_20px_40px_20px]",
  "rounded-[10px_28px_14px_22px]",
  "rounded-[26px_10px_24px_12px]",
  "rounded-[14px_22px_18px_30px]",
  "rounded-[30px_14px_20px_10px]",
  "rounded-[12px_18px_30px_18px]",
  "rounded-[22px_8px_14px_32px]",
];

interface GuideCardData {
  region: ForecastRegion;
  guideSlug: string;
  summary: RegionalForecastSummary | undefined;
  photoUrl: string | null;
  isFeatured: boolean;
}

function pickFeaturedIndex(
  guideLinks: GuideLink[],
  activeRegionSlug: string,
  summaries: Record<string, RegionalForecastSummary>,
): number {
  // Prefer a guide whose mapped region matches the active region.
  const activeIdx = guideLinks.findIndex(
    (g) => g.region.slug === activeRegionSlug,
  );
  if (activeIdx >= 0) return activeIdx;

  // Otherwise pick the guide whose region currently has the highest peak-week
  // score — this surfaces "what's firing" at the top of the guides strip.
  let bestIdx = 0;
  let bestScore = -Infinity;
  guideLinks.forEach((g, i) => {
    const summary = summaries[g.region.slug];
    if (!summary || summary.days.length === 0) return;
    const peak = summary.days.reduce((m, d) => (d.score > m ? d.score : m), 0);
    if (peak > bestScore) {
      bestScore = peak;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function FeaturedGuideCard({ region, guideSlug, photoUrl }: GuideCardData) {
  const subtitle = getRegionalGuideSubtitle(guideSlug);
  return (
    <Link
      href={`/guides/surfing-${guideSlug}`}
      data-testid={`guide-card-featured-${guideSlug}`}
      className="group relative col-span-12 overflow-hidden shadow-[0_6px_0_rgba(0,0,0,0.3)] transition-transform motion-reduce:transform-none hover:-rotate-0 hover:scale-[1.01] md:col-span-8 md:row-span-2 rounded-[36px_14px_40px_12px] -rotate-[1deg] bg-[#1f265f]"
    >
      {photoUrl ? (
        <>
          <Image
            src={photoUrl}
            alt={region.name}
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0f143d]/95 via-[#0f143d]/55 to-[#0f143d]/10"
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 7px)",
          }}
        />
      )}

      <div className="relative flex min-h-[20rem] flex-col justify-end p-6 md:min-h-[26rem] md:p-8">
        <span className="mb-3 inline-flex w-fit -rotate-[2deg] items-center rounded-[10px_4px_14px_4px] border border-[#F78E42]/50 bg-[#F78E42]/20 px-2.5 py-1 font-[var(--font-handwritten)] text-base text-[#F78E42]">
          Featured
        </span>
        <h3 className="font-[var(--font-heading)] text-2xl font-bold leading-tight text-white md:text-3xl">
          {region.name} Guide
        </h3>
        <p className="mt-2 max-w-lg text-sm text-white/85 md:text-base">
          {subtitle}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#F78E42] transition group-hover:gap-2.5">
          Read the guide
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function StandardGuideCard({
  region,
  guideSlug,
  photoUrl,
  rotationClass,
  shapeClass,
}: GuideCardData & { rotationClass: string; shapeClass: string }) {
  const subtitle = getRegionalGuideSubtitle(guideSlug);
  return (
    <Link
      href={`/guides/surfing-${guideSlug}`}
      data-testid={`guide-card-${guideSlug}`}
      className={`group relative col-span-12 overflow-hidden bg-[#1b2255] shadow-[0_3px_0_rgba(0,0,0,0.3)] transition-transform motion-reduce:rotate-0 motion-reduce:transform-none hover:rotate-0 hover:scale-[1.015] sm:col-span-6 md:col-span-4 ${shapeClass} ${rotationClass}`}
    >
      {photoUrl ? (
        <>
          <Image
            src={photoUrl}
            alt={region.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0f143d]/95 via-[#0f143d]/70 to-[#0f143d]/25"
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 6px)",
          }}
        />
      )}

      <div className="relative flex min-h-[10rem] flex-col justify-end p-4 md:min-h-[12rem] md:p-5">
        <h3 className="font-[var(--font-heading)] text-lg font-bold leading-tight text-white">
          {region.name}
        </h3>
        <p className="mt-1 text-xs leading-snug text-white/75 md:text-sm">
          {subtitle}
        </p>
      </div>
    </Link>
  );
}

export function RegionalGuidesStrip({
  summaries,
  activeRegionSlug,
  guideLinks,
  variant = "default",
}: RegionalGuidesStripProps) {
  if (guideLinks.length === 0) return null;

  const isZine = variant === "zine";

  const featuredIdx = pickFeaturedIndex(
    guideLinks,
    activeRegionSlug,
    summaries,
  );

  // Reorder: featured first, remaining retain their relative order.
  const ordered: GuideCardData[] = [];
  const featured = guideLinks[featuredIdx];
  const featuredSummary = summaries[featured.region.slug];
  ordered.push({
    region: featured.region,
    guideSlug: featured.guideSlug,
    summary: featuredSummary,
    photoUrl: featuredSummary?.photoUrl ?? null,
    isFeatured: true,
  });
  guideLinks.forEach((g, i) => {
    if (i === featuredIdx) return;
    const s = summaries[g.region.slug];
    ordered.push({
      region: g.region,
      guideSlug: g.guideSlug,
      summary: s,
      photoUrl: s?.photoUrl ?? null,
      isFeatured: false,
    });
  });

  return (
    <section className="mb-12" aria-labelledby="regional-guides-heading">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2
          id="regional-guides-heading"
          className={
            isZine
              ? "font-display text-3xl font-black uppercase leading-tight text-[#11100D]"
              : "font-[var(--font-heading)] text-2xl font-bold text-white sm:text-3xl"
          }
        >
          Regional Surf Guides
        </h2>
        <span
          className={
            isZine
              ? "font-[var(--font-handwritten)] text-lg text-[#11100D]/55"
              : "font-[var(--font-handwritten)] text-lg text-white/55"
          }
        >
          local knowledge, by region
        </span>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-5">
        {ordered.map((card, i) => {
          if (card.isFeatured) {
            return <FeaturedGuideCard key={card.guideSlug} {...card} />;
          }
          // Skip index 0 (featured) — start rotation/shape cycle at 1.
          const cycleIdx = i % CARD_ROTATIONS.length;
          return (
            <StandardGuideCard
              key={card.guideSlug}
              {...card}
              rotationClass={CARD_ROTATIONS[cycleIdx]}
              shapeClass={CARD_SHAPES[cycleIdx]}
            />
          );
        })}
      </div>
    </section>
  );
}
