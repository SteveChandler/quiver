import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
import { ToolHero } from "@/components/tools/tool-hero";
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

export default function ToolsIndexPage() {
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

      <div className="min-h-screen" style={{ background: "#0F1535" }}>
        <ToolHero
          imageSrc={TOOL_IMAGES["tools-index"]}
          imageAlt="Aerial view of a coastline with surf zones and sandy beach."
          title="The Surfer's Toolkit"
          description="Quick answers for the questions every surfer asks."
        />

        <div className="container mx-auto max-w-6xl px-4 py-10">
          <section className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white">
                Surf tools that connect the quick check to the full forecast
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#B8C7E0] sm:text-base">
                <p>
                  Use these calculators when you need one clean answer: what the
                  tide is doing, how a reported wave size translates, whether
                  the wind is offshore, or when first light gives you enough
                  visibility for a dawn patrol. Each tool is built for a fast
                  pre-surf check, then points you back to Quiver&#39;s beach and
                  forecast pages when you need the full call.
                </p>
                <p>
                  Start with the{" "}
                  <Link
                    href="/forecast"
                    className="text-[#F78E42] hover:underline"
                  >
                    7-day surf forecast
                  </Link>
                  , scan the{" "}
                  <Link href="/map" className="text-[#F78E42] hover:underline">
                    surf map
                  </Link>
                  , or compare regional conditions with{" "}
                  <Link
                    href="/tide/san-diego"
                    className="text-[#F78E42] hover:underline"
                  >
                    San Diego tide charts
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/water-temp/san-diego"
                    className="text-[#F78E42] hover:underline"
                  >
                    San Diego water temperatures
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div
              className="rounded-xl border p-5"
              style={{
                background: "rgba(30, 37, 88, 0.7)",
                borderColor: "rgba(64, 76, 146, 0.4)",
              }}
            >
              <h2 className="font-heading text-lg font-semibold text-white">
                Popular planning links
              </h2>
              <div className="mt-4 grid gap-2 text-sm">
                <Link
                  href="/forecast"
                  className="text-[#B8C7E0] hover:text-[#F78E42]"
                >
                  Full surf forecast
                </Link>
                <Link
                  href="/tide/san-diego"
                  className="text-[#B8C7E0] hover:text-[#F78E42]"
                >
                  Tide charts by city
                </Link>
                <Link
                  href="/water-temp/san-diego"
                  className="text-[#B8C7E0] hover:text-[#F78E42]"
                >
                  Water temperature guide
                </Link>
                <Link
                  href="/beaches/usa/ca/san-diego"
                  className="text-[#B8C7E0] hover:text-[#F78E42]"
                >
                  San Diego beach pages
                </Link>
                <Link
                  href="/map"
                  className="text-[#B8C7E0] hover:text-[#F78E42]"
                >
                  Explore the surf map
                </Link>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const href =
                "external" in tool && tool.external
                  ? tool.slug
                  : `/tools/${tool.slug}`;
              return (
                <Link
                  key={tool.slug}
                  href={href}
                  className="group relative overflow-hidden rounded-xl border border-[rgba(64,76,146,0.4)] hover:border-[rgba(247,142,66,0.5)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
                >
                  <Image
                    src={tool.image}
                    alt={tool.imageAlt}
                    fill
                    className="object-cover opacity-15 group-hover:opacity-25 transition-opacity duration-300"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(30,37,88,0.95)] to-[rgba(30,37,88,0.7)]" />
                  <div className="relative z-10 p-5">
                    <div
                      className="inline-flex items-center justify-center h-10 w-10 rounded-lg mb-3"
                      style={{ background: "rgba(247, 142, 66, 0.12)" }}
                    >
                      <Icon className="h-5 w-5" style={{ color: "#F78E42" }} />
                    </div>
                    <h2 className="font-heading text-lg font-semibold text-white group-hover:text-[#F78E42] transition-colors">
                      {tool.name}
                    </h2>
                    <p className="mt-1 text-sm text-[#B8C7E0] leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
