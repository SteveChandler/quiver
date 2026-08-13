"use client";

import Link from "next/link";
import { Users, TrendingUp, Waves, Compass, Clock, Thermometer, Mountain, type LucideIcon } from "lucide-react";

import type { HubRegion } from "@/lib/data/hub-regions";
import { OceanBackground } from "@/components/ui/ocean-background";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { HubMapClient } from "./hub-map-client";
import type { Beach } from "@/types/database";

interface RegionStats {
  total: number;
  beginner: number;
  intermediate: number;
  advanced: number;
  cities: number;
}

interface HubRegionClientProps {
  region: HubRegion;
  beaches: Beach[];
  stats: RegionStats;
}

/**
 * Category link configuration for the browse section
 */
interface CategoryLink {
  key: string;
  pathPrefix: string;
  title: string;
  description: string;
  icon: LucideIcon;
  colors: {
    bg: string;
    bgHover: string;
    icon: string;
    hoverGradient: string;
    border: string;
  };
}

const CATEGORY_LINKS: CategoryLink[] = [
  {
    key: "beginner",
    pathPrefix: "/beginner",
    title: "Beginner Spots",
    description: "Find gentle waves perfect for learning",
    icon: TrendingUp,
    colors: {
      bg: "bg-emerald-500/20",
      bgHover: "group-hover:bg-emerald-500/30",
      icon: "text-emerald-400",
      hoverGradient: "",
      border: "hover:border-white/20",
    },
  },
  {
    key: "crowded",
    pathPrefix: "/least-crowded",
    title: "Least Crowded",
    description: "Escape the crowds at hidden gems",
    icon: Compass,
    colors: {
      bg: "bg-[#4A70D9]/20",
      bgHover: "group-hover:bg-[#4A70D9]/30",
      icon: "text-[#4A70D9]",
      hoverGradient: "",
      border: "hover:border-white/20",
    },
  },
  {
    key: "tide",
    pathPrefix: "/tide",
    title: "Tide Reports",
    description: "Check optimal tide windows",
    icon: Clock,
    colors: {
      bg: "bg-sky-500/20",
      bgHover: "group-hover:bg-sky-500/30",
      icon: "text-sky-400",
      hoverGradient: "",
      border: "hover:border-white/20",
    },
  },
  {
    key: "temp",
    pathPrefix: "/water-temp",
    title: "Water Temp",
    description: "See current water temperatures",
    icon: Thermometer,
    colors: {
      bg: "bg-[#F78E42]/20",
      bgHover: "group-hover:bg-[#F78E42]/30",
      icon: "text-[#F78E42]",
      hoverGradient: "",
      border: "hover:border-white/20",
    },
  },
];

/**
 * Reusable category link card component
 */
function CategoryLinkCard({
  category,
  stateSlug,
}: {
  category: CategoryLink;
  stateSlug: string;
}) {
  const Icon = category.icon;

  return (
    <Link
      href={`${category.pathPrefix}/${stateSlug}`}
      className={`group block p-5 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:bg-white/[0.08] hover:-translate-y-1 ${category.colors.border} transition-[background-color,border-color,transform] duration-300`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`p-2 rounded-lg ${category.colors.bg} ${category.colors.bgHover} transition-colors`}
        >
          <Icon className={`h-5 w-5 ${category.colors.icon}`} />
        </div>
        <h3 className="font-semibold text-white">{category.title}</h3>
      </div>
      <p className="text-sm text-white/60 pl-11">{category.description}</p>
    </Link>
  );
}

export function HubRegionClient({ region, beaches, stats }: HubRegionClientProps) {
  // For regions with a single state, show all categories
  // For multi-state regions, we show the first state's links (most regions have 1 state)
  const primaryState = region.states[0];

  return (
    <OceanBackground variant="ocean" showWaves waveOpacity={0.25}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <ScrollReveal variant="fadeUp">
          <header className="mb-10">
            <nav className="text-sm mb-4">
              <Link
                href="/guides"
                className="text-ocean-blue hover:underline inline-flex items-center gap-1 font-medium"
              >
                ← Back to Surf Guides
              </Link>
            </nav>

            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {region.title}
            </h1>
            <p className="text-lg md:text-xl text-white/60 max-w-3xl">
              {region.description}
            </p>
          </header>
        </ScrollReveal>

        {/* Stats Cards */}
        <section className="mb-12">
          <ScrollReveal stagger staggerDelay={100} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/[0.04] backdrop-blur-md rounded-xl p-5 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-[#4A70D9]/20">
                  <Waves className="h-5 w-5 text-[#4A70D9]" />
                </div>
                <h3 className="text-sm font-medium text-white/70">
                  Total Spots
                </h3>
              </div>
              <p className="text-3xl font-bold text-white">
                <AnimatedCounter value={stats.total} duration={1000} />
              </p>
            </div>

            <div className="bg-white/[0.04] backdrop-blur-md rounded-xl p-5 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-sm font-medium text-white/70">Beginner</h3>
              </div>
              <p className="text-3xl font-bold text-white">
                <AnimatedCounter value={stats.beginner} duration={1000} />
              </p>
            </div>

            <div className="bg-white/[0.04] backdrop-blur-md rounded-xl p-5 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-[#F78E42]/20">
                  <Users className="h-5 w-5 text-[#F78E42]" />
                </div>
                <h3 className="text-sm font-medium text-white/70">
                  Intermediate
                </h3>
              </div>
              <p className="text-3xl font-bold text-white">
                <AnimatedCounter value={stats.intermediate} duration={1000} />
              </p>
            </div>

            <div className="bg-white/[0.04] backdrop-blur-md rounded-xl p-5 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Mountain className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="text-sm font-medium text-white/70">Advanced</h3>
              </div>
              <p className="text-3xl font-bold text-white">
                <AnimatedCounter value={stats.advanced} duration={1000} />
              </p>
            </div>
          </ScrollReveal>
        </section>

        {/* Interactive Map */}
        <ScrollReveal variant="fadeUp" delay={200}>
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Explore Surf Spots
            </h2>
            <p className="text-white/60 mb-4">
              Click any marker to view spot details. Markers are color-coded by
              skill level: green for beginner, blue for intermediate, dark for
              advanced.
            </p>
            <div className="h-[500px] rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl">
              <HubMapClient
                beaches={beaches}
                centerLatitude={region.centerLat}
                centerLongitude={region.centerLon}
                zoom={region.zoom}
              />
            </div>
          </section>
        </ScrollReveal>

        {/* Quick Links Section */}
        <ScrollReveal variant="fadeUp" delay={300}>
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Browse by Category
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {CATEGORY_LINKS.map((category) => (
                <CategoryLinkCard
                  key={category.key}
                  category={category}
                  stateSlug={primaryState}
                />
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* About Section */}
        <ScrollReveal variant="fadeUp" delay={400}>
          <section className="prose prose-slate max-w-none">
            <h2 className="text-2xl font-semibold text-white mb-4">
              About {region.name} Surfing
            </h2>
            <div className="bg-white/[0.04] backdrop-blur-md rounded-xl p-6 border border-white/[0.08]">
              <p className="text-white/70">{region.description}</p>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </OceanBackground>
  );
}
