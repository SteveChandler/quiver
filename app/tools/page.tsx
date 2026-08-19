import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { ReactElement } from "react";
import {
  Waves,
  Ruler,
  Calendar,
  Wind,
  Droplets,
  Sunrise,
  Gauge,
  ArrowUpDown,
} from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { SITE_URL } from "@/lib/constants/seo";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { TOOL_IMAGES } from "@/lib/constants/tool-images";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "The Surfer's Toolkit — Tide Clock, Wave Converter & More",
  description:
    "Essential tools every surfer needs: tide clock, wave height converter, offshore wind checker, dawn patrol calculator, surfboard size guide & more.",
  path: "/tools",
  image: "/images/tools/aerial-coastline.jpg",
  keywords: [
    "surf tools",
    "tide clock",
    "wave height converter",
    "surfboard volume calculator",
    "offshore wind checker",
    "dawn patrol calculator",
    "swell analyzer",
    "water quality beach",
    "best time to surf",
  ],
});

const TOOLS = [
  {
    slug: "tide-clock",
    name: "Tide Clock",
    description:
      "Real-time tide height, next high/low, and 24-hour tide curve for any beach.",
    icon: Waves,
    color: "text-blue-500",
    bg: "bg-blue-50",
    image: TOOL_IMAGES["tide-clock"],
    imageAlt: "Rocky tide pools exposed at low tide.",
  },
  {
    slug: "wave-converter",
    name: "Wave Height Converter",
    description:
      "Convert between feet, meters, Hawaiian scale, and back height instantly.",
    icon: ArrowUpDown,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    image: TOOL_IMAGES["wave-converter"],
    imageAlt: "Wave height converter preview with surf size measurements.",
  },
  {
    slug: "wind-checker",
    name: "Offshore Wind Checker",
    description:
      "Visual compass showing whether wind is offshore, onshore, or cross-shore at your break.",
    icon: Wind,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
    image: TOOL_IMAGES["wind-checker"],
    imageAlt:
      "Offshore wind checker preview showing wind direction at a surf break.",
  },
  {
    slug: "dawn-patrol",
    name: "Dawn Patrol Calculator",
    description:
      "First light, sunrise, and tide state at dawn — plan your morning session.",
    icon: Sunrise,
    color: "text-amber-500",
    bg: "bg-amber-50",
    image: TOOL_IMAGES["dawn-patrol"],
    imageAlt: "Surfer walking along the beach near sunset.",
  },
  {
    slug: "board-calculator",
    name: "Surfboard Volume Calculator",
    description:
      "Find the right board volume for your weight, skill level, and the waves you ride.",
    icon: Ruler,
    color: "text-violet-500",
    bg: "bg-violet-50",
    image: TOOL_IMAGES["board-calculator"],
    imageAlt: "Surfboard volume calculator preview with board size controls.",
  },
  {
    slug: "swell-analyzer",
    name: "Swell Quality Analyzer",
    description:
      "Understand how swell period and direction affect wave quality at your beach.",
    icon: Gauge,
    color: "text-orange-500",
    bg: "bg-orange-50",
    image: TOOL_IMAGES["swell-analyzer"],
    imageAlt: "Clean hollow wave used for swell quality analysis.",
  },
  {
    slug: "water-quality",
    name: "Water Quality Check",
    description:
      "Bacteria levels and swim safety status from EPA monitoring stations. CA & HI.",
    icon: Droplets,
    color: "text-teal-500",
    bg: "bg-teal-50",
    image: TOOL_IMAGES["water-quality"],
    imageAlt: "Underwater kelp forest representing coastal water quality.",
  },
  {
    slug: "/best-time-to-surf",
    name: "Best Month to Surf",
    description:
      "Month-by-month guide: wave heights, water temps, wetsuits, and crowd levels for every coast.",
    icon: Calendar,
    color: "text-rose-500",
    bg: "bg-rose-50",
    external: true as const,
    image: TOOL_IMAGES["best-time-to-surf"],
    imageAlt: "Aerial coastline view for seasonal surf planning.",
  },
];

export default function ToolsIndexPage(): ReactElement {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Surfer's Toolkit", url: `${SITE_URL}/tools` },
        ]}
      />
      <WebPageSchema
        name="The Surfer's Toolkit — Tide Clock, Wave Converter & More"
        url={`${SITE_URL}/tools`}
        description="Essential tools every surfer needs: tide clock, wave height converter, offshore wind checker, dawn patrol calculator, surfboard size guide & more."
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "The Surfer's Toolkit",
            description: "Essential tools every surfer needs.",
            numberOfItems: TOOLS.length,
            itemListElement: TOOLS.map((tool, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: tool.name,
              url: `${SITE_URL}${"external" in tool && tool.external ? tool.slug : `/tools/${tool.slug}`}`,
            })),
          }),
        }}
      />

      <ZineSurface
        sectionLabel="Tools"
        editionLabel="Surfer's toolkit"
        data-testid="tools-zine-surface"
      >
        <main>
          <header className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
            <ScrollReveal>
              <div className="relative">
                <QuiverSticker
                  sticker="orangeTape"
                  className="absolute -top-8 right-10 hidden w-36 rotate-6 opacity-90 sm:block"
                />
                <p className="label-black mb-5">Field guide / Tools</p>
                <h1 className="zine-h1 font-heading font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                  The Surfer&apos;s Toolkit
                </h1>
                <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
                  Quick answers for the questions every surfer asks.
                </p>
                <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
                  <span>{TOOLS.length} field tools</span>
                  <span aria-hidden>/</span>
                  <span>tide, wind, swell</span>
                  <span aria-hidden>/</span>
                  <span>fast pre-surf checks</span>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <div className="polaroid rot-2">
                <div className="photo" style={{ aspectRatio: "16 / 10" }}>
                  <Image
                    src={TOOL_IMAGES["tools-index"]}
                    alt="Aerial view of a coastline with surf zones and sandy beach."
                    fill
                    className="object-cover object-center saturate-[0.9]"
                    sizes="(min-width: 1024px) 440px, 100vw"
                    preload
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-[#252D6B]/5 mix-blend-multiply" />
                  <QuiverSticker
                    sticker="spotSwellMatch"
                    className="absolute -bottom-7 -right-5 w-28 rotate-6 drop-shadow-md"
                  />
                </div>
                <p className="cap">pick the right window</p>
              </div>
            </ScrollReveal>
          </header>

          <ScrollReveal>
            <section className="torn torn-tb rot-neg mt-12 border-2 border-[#11100D] bg-[#F0E5CC]">
              <div className="grid gap-5 md:grid-cols-[0.95fr_1.05fr] md:items-center">
                <div>
                  <p className="typewriter mb-2">Quick check</p>
                  <h2 className="font-heading text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
                    Surf tools that connect the quick check to the full forecast
                  </h2>
                </div>
                <div className="space-y-3 text-base leading-relaxed text-[#11100D]/74">
                  <p>
                    Use these calculators when you need one clean answer: what the
                    tide is doing, how a reported wave size translates, whether
                    the wind is offshore, or when first light gives you enough
                    visibility for a dawn patrol. Each tool is built for a fast
                    pre-surf check, then points you back to Quiver&apos;s beach and
                    forecast pages when you need the full call.
                  </p>
                  <p>
                    Start with the{" "}
                    <Link
                      href="/forecast"
                      className="font-bold text-[#B56A2B] underline decoration-[#F78E42]/60 decoration-2 underline-offset-4 hover:text-[#11100D]"
                    >
                      7-day surf forecast
                    </Link>
                    , scan the{" "}
                    <Link
                      href="/map"
                      className="font-bold text-[#B56A2B] underline decoration-[#F78E42]/60 decoration-2 underline-offset-4 hover:text-[#11100D]"
                    >
                      surf map
                    </Link>
                    , or compare regional conditions with{" "}
                    <Link
                      href="/tide/san-diego"
                      className="font-bold text-[#B56A2B] underline decoration-[#F78E42]/60 decoration-2 underline-offset-4 hover:text-[#11100D]"
                    >
                      San Diego tide charts
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/water-temp/san-diego"
                      className="font-bold text-[#B56A2B] underline decoration-[#F78E42]/60 decoration-2 underline-offset-4 hover:text-[#11100D]"
                    >
                      San Diego water temperatures
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </section>
          </ScrollReveal>

          <section className="mt-14 grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <ScrollReveal>
              <aside className="relative">
                <QuiverSticker
                  sticker="creamTape"
                  className="absolute -top-6 left-8 z-10 w-28 -rotate-6 opacity-90"
                />
                <div className="utility-strip border-2 border-[#11100D]">
                  <h2 className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D]">
                    Popular planning links
                  </h2>
                  <div className="mt-5 grid gap-3 text-sm">
                    <Link
                      href="/forecast"
                      className="border-b-2 border-dashed border-[#11100D]/30 pb-2 font-semibold text-[#11100D] hover:text-[#B56A2B]"
                    >
                      Full surf forecast
                    </Link>
                    <Link
                      href="/tide/san-diego"
                      className="border-b-2 border-dashed border-[#11100D]/30 pb-2 font-semibold text-[#11100D] hover:text-[#B56A2B]"
                    >
                      Tide charts by city
                    </Link>
                    <Link
                      href="/water-temp/san-diego"
                      className="border-b-2 border-dashed border-[#11100D]/30 pb-2 font-semibold text-[#11100D] hover:text-[#B56A2B]"
                    >
                      Water temperature guide
                    </Link>
                    <Link
                      href="/beaches/usa/ca/san-diego"
                      className="border-b-2 border-dashed border-[#11100D]/30 pb-2 font-semibold text-[#11100D] hover:text-[#B56A2B]"
                    >
                      San Diego beach pages
                    </Link>
                    <Link
                      href="/map"
                      className="font-semibold text-[#11100D] hover:text-[#B56A2B]"
                    >
                      Explore the surf map
                    </Link>
                  </div>
                </div>
              </aside>
            </ScrollReveal>

            <div>
              <ScrollReveal>
                <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
                  <div>
                    <p className="typewriter mb-2">Field cards</p>
                    <h2 className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
                      Choose the calculator for the call you need
                    </h2>
                  </div>
                  <QuiverSticker
                    sticker="spotWindRead"
                    className="hidden w-16 rotate-6 drop-shadow-sm sm:block"
                  />
                </div>
              </ScrollReveal>

              <div className="grid gap-5 sm:grid-cols-2">
                {TOOLS.map((tool, index) => {
                  const Icon = tool.icon;
                  const href =
                    "external" in tool && tool.external
                      ? tool.slug
                      : `/tools/${tool.slug}`;

                  return (
                    <ScrollReveal key={tool.slug} delay={(index % 3) * 50}>
                      <Link
                        href={href}
                        className="group block h-full border-2 border-[#11100D] bg-[#FBF6E8] p-3 shadow-[2px_3px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
                      >
                        <div className="relative overflow-hidden border-2 border-[#11100D] bg-[#D9C49C]">
                          <div className="relative aspect-[16/10]">
                            <Image
                              src={tool.image}
                              alt={tool.imageAlt}
                              fill
                              className="object-cover object-center saturate-[0.82] transition-transform duration-300 group-hover:scale-[1.03]"
                              sizes="(min-width: 1280px) 24vw, (min-width: 640px) 45vw, 100vw"
                            />
                            <div className="absolute inset-0 bg-[#F4EBD8]/10 mix-blend-screen" />
                          </div>
                        </div>
                        <div className="mt-4 flex items-start gap-3">
                          <span className="circled shrink-0 bg-[#F78E42]/35">
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          <div>
                            <h2 className="font-heading text-lg font-black uppercase leading-tight text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                              {tool.name}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#11100D]/70">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </ScrollReveal>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      </ZineSurface>
    </>
  );
}
