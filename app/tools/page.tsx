import type { Metadata } from "next";
import Link from "next/link";
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

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Free Surf Tools — Tide Clock, Wave Converter & More",
  description:
    "Free tools for surfers: tide clock, wave height converter, offshore wind checker, dawn patrol calculator, surfboard size guide & more. No signup required.",
  path: "/tools",
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
  },
  {
    slug: "wave-converter",
    name: "Wave Height Converter",
    description:
      "Convert between feet, meters, Hawaiian scale, and back height instantly.",
    icon: ArrowUpDown,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    slug: "wind-checker",
    name: "Offshore Wind Checker",
    description:
      "Visual compass showing whether wind is offshore, onshore, or cross-shore at your break.",
    icon: Wind,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
  },
  {
    slug: "dawn-patrol",
    name: "Dawn Patrol Calculator",
    description:
      "First light, sunrise, and tide state at dawn — plan your morning session.",
    icon: Sunrise,
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
  {
    slug: "board-calculator",
    name: "Surfboard Volume Calculator",
    description:
      "Find the right board volume for your weight, skill level, and the waves you ride.",
    icon: Ruler,
    color: "text-violet-500",
    bg: "bg-violet-50",
  },
  {
    slug: "swell-analyzer",
    name: "Swell Quality Analyzer",
    description:
      "Understand how swell period and direction affect wave quality at your beach.",
    icon: Gauge,
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
  {
    slug: "water-quality",
    name: "Water Quality Check",
    description:
      "Bacteria levels and swim safety status from EPA monitoring stations. CA & HI.",
    icon: Droplets,
    color: "text-teal-500",
    bg: "bg-teal-50",
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
  },
];

export default function ToolsIndexPage() {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Free Tools", url: `${SITE_URL}/tools` },
        ]}
      />
      <WebPageSchema
        name="Free Surf Tools — Tide Clock, Wave Converter & More"
        url={`${SITE_URL}/tools`}
        description="Free tools for surfers: tide clock, wave height converter, offshore wind checker, dawn patrol calculator, surfboard size guide & more."
      />

      <div className="min-h-screen" style={{ background: "#0F1535" }}>
        {/* Header */}
        <section
          className="noise-texture border-b"
          style={{
            background: "linear-gradient(180deg, #1E2558 0%, #252D6B 100%)",
            borderColor: "rgba(64,76,146,0.4)",
          }}
        >
          <div className="container mx-auto max-w-6xl px-4 py-10 sm:py-14">
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-white mb-3">
              Free Surf Tools
            </h1>
            <p className="text-[#B8C7E0] text-lg leading-relaxed max-w-2xl">
              Quick answers for the questions every surfer asks. No signup, no
              paywall — just useful tools powered by real data.
            </p>
          </div>
        </section>

        <div className="container mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const href = "external" in tool && tool.external ? tool.slug : `/tools/${tool.slug}`;
              return (
                <Link
                  key={tool.slug}
                  href={href}
                  className="group rounded-xl border p-5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
                  style={{
                    background: "rgba(30, 37, 88, 0.7)",
                    borderColor: "rgba(64, 76, 146, 0.4)",
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(247, 142, 66, 0.5)";
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(64, 76, 146, 0.4)";
                  }}
                >
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
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
