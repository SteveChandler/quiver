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
    "Essential tools every surfer needs: tide clock, wave height converter, offshore wind checker, dawn patrol calculator, surfboard size guide & more. No signup required.",
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
            description: "Essential free tools every surfer needs.",
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
          title="The Surfer's Toolkit"
          description="Quick answers for the questions every surfer asks. No signup, no paywall — just useful tools powered by real data."
        />

        <div className="container mx-auto max-w-6xl px-4 py-10">
          {/* Intro section for SEO */}
          <section className="mb-8 max-w-3xl">
            <p className="text-[#B8C7E0] text-sm leading-relaxed mb-3">
              Every tool below is free, works on any device, and requires no account. Data is sourced from{" "}
              <strong className="text-white">NOAA CO-OPS</strong> (tides),{" "}
              <strong className="text-white">Open-Meteo</strong> (wind forecasts),{" "}
              <strong className="text-white">EPA monitoring stations</strong> (water quality via CEDEN and PacIOOS), and astronomical calculations (sunrise and civil twilight times).
            </p>
            <p className="text-[#B8C7E0] text-sm leading-relaxed">
              Built for surfers who want quick, reliable answers — whether you&apos;re checking tides before dawn patrol, figuring out if the wind is offshore, or deciding what size board to ride. Each tool covers 279+ beaches across the US, Hawaii, and Puerto Rico.
            </p>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const href = "external" in tool && tool.external ? tool.slug : `/tools/${tool.slug}`;
              return (
                <Link
                  key={tool.slug}
                  href={href}
                  className="group relative overflow-hidden rounded-xl border border-[rgba(64,76,146,0.4)] hover:border-[rgba(247,142,66,0.5)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
                >
                  <Image
                    src={tool.image}
                    alt=""
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
