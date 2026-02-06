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
      bg: "bg-green-100",
      bgHover: "group-hover:bg-green-200",
      icon: "text-green-600",
      hoverGradient: "hover:from-green-50 hover:to-emerald-50",
      border: "hover:border-green-300",
    },
  },
  {
    key: "crowded",
    pathPrefix: "/least-crowded",
    title: "Least Crowded",
    description: "Escape the crowds at hidden gems",
    icon: Compass,
    colors: {
      bg: "bg-blue-100",
      bgHover: "group-hover:bg-blue-200",
      icon: "text-blue-600",
      hoverGradient: "hover:from-blue-50 hover:to-sky-50",
      border: "hover:border-blue-300",
    },
  },
  {
    key: "tide",
    pathPrefix: "/tide",
    title: "Tide Reports",
    description: "Check optimal tide windows",
    icon: Clock,
    colors: {
      bg: "bg-sky-100",
      bgHover: "group-hover:bg-sky-200",
      icon: "text-sky-600",
      hoverGradient: "hover:from-sky-50 hover:to-cyan-50",
      border: "hover:border-sky-300",
    },
  },
  {
    key: "temp",
    pathPrefix: "/water-temp",
    title: "Water Temp",
    description: "See current water temperatures",
    icon: Thermometer,
    colors: {
      bg: "bg-orange-100",
      bgHover: "group-hover:bg-orange-200",
      icon: "text-orange-600",
      hoverGradient: "hover:from-orange-50 hover:to-amber-50",
      border: "hover:border-orange-300",
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
      className={`group block p-5 rounded-xl border border-gray-200/50 bg-white/60 backdrop-blur-sm shadow-md hover:shadow-lg hover:-translate-y-1 hover:bg-gradient-to-br ${category.colors.hoverGradient} ${category.colors.border} transition-all duration-300`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`p-2 rounded-lg ${category.colors.bg} ${category.colors.bgHover} transition-colors`}
        >
          <Icon className={`h-5 w-5 ${category.colors.icon}`} />
        </div>
        <h3 className="font-semibold text-gray-900">{category.title}</h3>
      </div>
      <p className="text-sm text-gray-600 pl-11">{category.description}</p>
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

            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              {region.title}
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl">
              {region.description}
            </p>
          </header>
        </ScrollReveal>

        {/* Stats Cards */}
        <section className="mb-12">
          <ScrollReveal stagger staggerDelay={100} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-sky-100/80 to-blue-100/80 backdrop-blur-sm rounded-xl p-5 border border-sky-200/50 shadow-lg hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <Waves className="h-5 w-5 text-sky-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-700">
                  Total Spots
                </h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                <AnimatedCounter value={stats.total} duration={1000} />
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-100/80 to-emerald-100/80 backdrop-blur-sm rounded-xl p-5 border border-green-200/50 shadow-lg hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-700">Beginner</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                <AnimatedCounter value={stats.beginner} duration={1000} />
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-100/80 to-indigo-100/80 backdrop-blur-sm rounded-xl p-5 border border-blue-200/50 shadow-lg hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-700">
                  Intermediate
                </h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                <AnimatedCounter value={stats.intermediate} duration={1000} />
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-100/80 to-gray-100/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200/50 shadow-lg hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-slate-500/10">
                  <Mountain className="h-5 w-5 text-slate-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-700">Advanced</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                <AnimatedCounter value={stats.advanced} duration={1000} />
              </p>
            </div>
          </ScrollReveal>
        </section>

        {/* Interactive Map */}
        <ScrollReveal variant="fadeUp" delay={200}>
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Explore Surf Spots
            </h2>
            <p className="text-gray-600 mb-4">
              Click any marker to view spot details. Markers are color-coded by
              skill level: green for beginner, blue for intermediate, dark for
              advanced.
            </p>
            <div className="h-[500px] rounded-2xl overflow-hidden border border-gray-200/50 shadow-xl">
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
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
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
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              About {region.name} Surfing
            </h2>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-lg">
              <p className="text-gray-700 mb-4">{region.description}</p>
              <p className="text-gray-700">
                Use Quiver to track conditions, plan sessions, and connect with
                the local surf community. Get real-time forecasts, tide charts,
                and crowd predictions for every spot in {region.name}.
              </p>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </OceanBackground>
  );
}
