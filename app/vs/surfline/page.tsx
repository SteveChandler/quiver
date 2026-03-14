/**
 * Quiver vs Surfline Comparison Page
 *
 * SEO comparison page targeting "surfline alternative" keywords.
 * Server component for full SEO indexability. Uses the retro-dark
 * design system with sticker-style badges and data-first layout.
 *
 * URL: /vs/surfline
 * ISR: 24 hours (86400s) — static content, updated infrequently
 */

import Link from "next/link";
import type { Metadata } from "next";
import { Check, X, Minus, ArrowRight, Zap, Shield, Users } from "lucide-react";

import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { SITE_URL } from "@/lib/constants/seo";
import {
  FadeInSection,
  AnimatedStickerBadge,
  AnimatedFeatureRow,
  PriceCountUp,
  HeroPulse,
  VsAnimationStyles,
} from "./animations";

// ISR: Revalidate every 24 hours (static comparison content)
export const revalidate = 86400;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = buildPageMetadata({
  title: "Quiver vs Surfline: Free Surf Forecasts That Don't Gate the Stoke (2026)",
  description:
    "Honest comparison of Quiver and Surfline in 2026. Crowd-sourced surf calls, tide charts, session logging. See where each app wins and decide for yourself.",
  path: "/vs/surfline",
  keywords: [
    "surfline alternative",
    "surfline vs quiver",
    "free surfline alternative",
    "best surf forecast app",
    "surfline alternative free",
    "surf forecast app comparison",
    "quiver surf app",
    "free surf forecast",
    "surfline premium alternative",
    "surf report app free",
  ],
});

// ---------------------------------------------------------------------------
// Structured Data
// ---------------------------------------------------------------------------

const SITE_ORIGIN = SITE_URL;

function ComparisonStructuredData() {
  const quiverApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Quiver Surf App",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web, iOS, Android",
    url: SITE_ORIGIN,
    description:
      "Crowd-sourced surf forecast app with crowd-sourced ML, tide charts, session logging, and community features for 185+ beaches.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const surflineApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Surfline",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web, iOS, Android",
    url: "https://www.surfline.com",
    description:
      "Surf forecast app with cam network, human forecaster reports, and premium subscription features.",
    offers: {
      "@type": "Offer",
      price: "99.99",
      priceCurrency: "USD",
      priceValidUntil: "2026-12-31",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [quiverApp, surflineApp],
        }),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// FAQ Data
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    question: "Is Quiver really free?",
    answer:
      "Yes, Quiver is free today. All surf forecasts, tide charts, session logging, and community features are available to every user at no cost. We may introduce premium features or ads in the future as we grow, but the core forecast data you need to make the call will always be accessible.",
  },
  {
    question: "How does Quiver's Oracle compare to Surfline's human forecasters?",
    answer:
      "Oracle is Quiver's crowd-sourced forecasting engine. It trains per-beach models on 30,000+ buoy observations to bias-correct NOAA forecasts every 3 hours, while session data from real surfers provides ground truth. Surfline employs human forecasters who write editorial surf reports. Both approaches have merit — Oracle excels at consistency, frequency, and community validation, while Surfline's forecasters add narrative context.",
  },
  {
    question: "What beaches does Quiver cover?",
    answer:
      "Quiver covers 185+ beaches across California, Hawaii, Oregon, Washington, Puerto Rico, Florida, the East Coast, and Baja Mexico. Every beach gets ML-corrected forecasts, tide charts, crowd data, and session logging — all free.",
  },
  {
    question: "Can I switch from Surfline to Quiver?",
    answer:
      "You can start using Quiver alongside Surfline immediately — there's nothing to cancel or migrate. Create a free account, set your home beaches, and start getting ML-powered surf calls. Many surfers use both apps and find that Quiver's free forecast data covers most of what they were paying Surfline for.",
  },
  {
    question: "Is this page biased toward Quiver?",
    answer:
      "This is Quiver's website, so yes, we have a perspective. But we've tried to be honest about where Surfline wins — they have more cameras, more international coverage, and decades of brand trust. We believe the best way to earn your trust is transparency, not spin. All Surfline pricing and feature information is sourced from their public website as of March 2026.",
  },
];

// ---------------------------------------------------------------------------
// Feature Comparison Data
// ---------------------------------------------------------------------------

type FeatureStatus = "free" | "paid" | "partial" | "none";

interface FeatureRow {
  feature: string;
  description: string;
  quiver: FeatureStatus;
  quiverNote?: string;
  surfline: FeatureStatus;
  surflineNote?: string;
}

const COMPARISON_FEATURES: FeatureRow[] = [
  {
    feature: "Swell & Wind Forecasts",
    description: "Wave height, swell direction/period, wind speed/direction",
    quiver: "free",
    quiverNote: "Crowd-sourced ML, updated every 3 hours",
    surfline: "partial",
    surflineNote: "Basic free, detailed behind Premium",
  },
  {
    feature: "Tide Charts",
    description: "High/low tide times with interactive chart",
    quiver: "free",
    quiverNote: "Interactive chart with surf windows",
    surfline: "partial",
    surflineNote: "Basic free, extended in Premium",
  },
  {
    feature: "Surf Conditions Rating",
    description: "Go/no-go surf call based on current conditions",
    quiver: "free",
    quiverNote: "Oracle: crowd-sourced + ML, per-beach",
    surfline: "paid",
    surflineNote: "Human forecasters, Premium only",
  },
{
    feature: "Session Logging",
    description: "Track surf sessions with conditions and photos",
    quiver: "free",
    quiverNote: "Full journal with photos and sharing",
    surfline: "free",
    surflineNote: "Session tracking available",
  },
  {
    feature: "Community Features",
    description: "Follow surfers, crew feeds, social sharing",
    quiver: "free",
    quiverNote: "Crew feeds, follows, session sharing",
    surfline: "partial",
    surflineNote: "Limited social features",
  },
  {
    feature: "Water Temperature",
    description: "Current water temp with wetsuit recommendations",
    quiver: "free",
    quiverNote: "Live buoy data + wetsuit recs",
    surfline: "free",
    surflineNote: "Water temp available",
  },
  {
    feature: "Crowd Data",
    description: "Crowd levels and best-time-to-go analysis",
    quiver: "free",
    quiverNote: "Crowd intel + optimal windows",
    surfline: "paid",
    surflineNote: "Crowd data in Premium",
  },
];

const PRICING = {
  quiver: { label: "Free", price: "$0", period: "" },
  surfline: { label: "Premium", price: "$99.99", period: "/year" },
} as const;

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  note,
  isQuiver,
}: {
  status: FeatureStatus;
  note?: string;
  isQuiver: boolean;
}) {
  const config = {
    free: {
      icon: <Check className="h-4 w-4" />,
      text: "Free",
      classes: isQuiver
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
        : "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20",
    },
    paid: {
      icon: <span className="text-xs font-mono font-bold">$</span>,
      text: "Premium",
      classes: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    },
    partial: {
      icon: <Minus className="h-4 w-4" />,
      text: "Partial",
      classes: "bg-slate-500/15 text-slate-300 border-slate-500/25",
    },
    none: {
      icon: <X className="h-4 w-4" />,
      text: "No",
      classes: "bg-red-500/15 text-red-300 border-red-500/25",
    },
  }[status];

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${config.classes}`}
      >
        {config.icon}
        {config.text}
      </span>
      {note && (
        <span className="text-[11px] text-muted-foreground text-center leading-tight max-w-[140px]">
          {note}
        </span>
      )}
    </div>
  );
}

function StickerBadge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-md bg-primary px-3 py-1 text-xs font-bold text-white font-heading uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function VsSurflinePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <VsAnimationStyles />
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Compare", url: `${SITE_ORIGIN}/vs/surfline` },
          { name: "Quiver vs Surfline", url: `${SITE_ORIGIN}/vs/surfline` },
        ]}
      />
      <ComparisonStructuredData />
      <FAQSchema items={FAQ_ITEMS} />

      {/* ================================================================= */}
      {/* Hero Section */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden px-4 pb-16 pt-12 md:pb-20 md:pt-16">
        {/* Subtle scan-line texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 3px)",
          }}
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <AnimatedStickerBadge>
              <StickerBadge>Updated March 2026</StickerBadge>
            </AnimatedStickerBadge>
            <AnimatedStickerBadge>
              <StickerBadge className="bg-emerald-600">
                Honest Comparison
              </StickerBadge>
            </AnimatedStickerBadge>
          </div>

          <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Quiver vs Surfline
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-sans text-lg text-muted-foreground sm:text-xl md:mt-6">
            The surf forecast you check every morning shouldn&apos;t cost $100/year.
            Quiver gives you crowd-sourced surf calls,
            tide charts, crowd data, and session logging{" "}
            <span className="font-semibold text-primary">
              — no paywall on the data that matters
            </span>
            .
          </p>

          <div className="mx-auto mt-8 grid max-w-lg grid-cols-2 gap-4 md:mt-10">
            <FadeInSection delay={100}>
              <HeroPulse>
                <div className="rounded-xl border border-border bg-card p-5 text-center">
                  <p className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Quiver
                  </p>
                  <p className="mt-1 font-mono text-3xl font-bold text-emerald-400">
                    $0
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Free</p>
                </div>
              </HeroPulse>
            </FadeInSection>
            <FadeInSection delay={250}>
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <p className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Surfline Premium
                </p>
                <p className="mt-1 font-mono text-3xl font-bold text-amber-400">
                  <PriceCountUp target={99.99} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">/year</p>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* The Quick Take */}
      {/* ================================================================= */}
      <section className="border-y border-border bg-card/50 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            The Quick Take
          </h2>
          <div className="mt-6 space-y-4 font-sans text-base leading-relaxed text-muted-foreground md:text-lg">
            <p>
              Surfline has been the default surf forecast app for over two decades.
              They pioneered the surf cam network, built a massive library of
              editorial content, and earned the trust of millions of surfers worldwide.
              That history matters.
            </p>
            <p>
              But the surf forecast landscape has changed. The core data that
              Surfline charges $99.99/year for — detailed swell forecasts, conditions
              ratings, and crowd info — is now available through apps like Quiver
              that combine crowd-sourced observations with machine learning to
              process the same NOAA, CDIP, and NDBC data sources.
            </p>
            <p>
              The question isn&apos;t whether Surfline is good. It&apos;s whether what
              you&apos;re paying for is worth $100/year when community-driven
              alternatives deliver comparable (and in some cases better) forecast
              accuracy through crowd-sourced ML — validated by surfers
              actually in the water.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Feature Comparison Table */}
      {/* ================================================================= */}
      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            Feature-by-Feature Comparison
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All pricing and feature information based on publicly available data
            as of March 2026.
          </p>

          {/* Desktop Table */}
          <FadeInSection className="mt-8 hidden md:block">
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-5 py-4 text-left font-heading font-semibold">
                      Feature
                    </th>
                    <th className="px-5 py-4 text-center font-heading font-semibold text-primary">
                      Quiver
                    </th>
                    <th className="px-5 py-4 text-center font-heading font-semibold text-muted-foreground">
                      Surfline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FEATURES.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-b border-border/50 ${
                        i % 2 === 0 ? "bg-background" : "bg-card/30"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-foreground">
                          {row.feature}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.description}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          status={row.quiver}
                          note={row.quiverNote}
                          isQuiver
                        />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          status={row.surfline}
                          note={row.surflineNote}
                          isQuiver={false}
                        />
                      </td>
                    </tr>
                  ))}

                  {/* Pricing row */}
                  <tr className="bg-card">
                    <td className="px-5 py-5">
                      <p className="font-heading font-bold text-foreground">
                        Price
                      </p>
                    </td>
                    <td className="px-5 py-5 text-center">
                      <span className="inline-block rounded-lg bg-emerald-600 px-4 py-1.5 font-mono text-sm font-bold text-white">
                        $0 — Free
                      </span>
                    </td>
                    <td className="px-5 py-5 text-center">
                      <span className="font-mono text-sm font-semibold text-muted-foreground">
                        $99.99/yr
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </FadeInSection>

          {/* Mobile Cards */}
          <div className="mt-8 space-y-3 md:hidden">
            {COMPARISON_FEATURES.map((row, i) => (
              <AnimatedFeatureRow key={row.feature} index={i}>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="font-heading text-sm font-semibold text-foreground">
                    {row.feature}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.description}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Quiver
                      </p>
                      <StatusBadge
                        status={row.quiver}
                        note={row.quiverNote}
                        isQuiver
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Surfline
                      </p>
                      <StatusBadge
                        status={row.surfline}
                        note={row.surflineNote}
                        isQuiver={false}
                      />
                    </div>
                  </div>
                </div>
              </AnimatedFeatureRow>
            ))}

            {/* Mobile pricing */}
            <div className="rounded-xl border-2 border-primary/30 bg-card p-4 text-center">
              <p className="font-heading text-sm font-semibold text-foreground">
                Bottom Line
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Quiver
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-emerald-400">
                    $0
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Surfline
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-amber-400">
                    $99.99/yr
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Where Surfline Wins */}
      {/* ================================================================= */}
      <section className="border-y border-border bg-card/50 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            Where Surfline Wins
          </h2>
          <p className="mt-2 font-sans text-muted-foreground">
            Being honest about the competition is the only way to earn your trust.
            Surfline has genuine advantages worth acknowledging.
          </p>

          <FadeInSection className="mt-8 grid gap-4 sm:grid-cols-2">
            <SurflineAdvantageCard
              title="Human Forecaster Content"
              description="Surfline employs experienced surfer-forecasters who write narrative
                surf reports with local insight. These editorial forecasts add context
                that pure data models don't provide — like 'the sandbar at the south
                end has been rebuilding.'"
            />
            <SurflineAdvantageCard
              title="Brand Trust & Track Record"
              description="Surfline has been around since 1985. That's four decades of
                building trust with the surf community. Quiver is newer and still
                proving itself. Some surfers prefer the familiarity and established
                reputation."
            />
            <SurflineAdvantageCard
              title="International Coverage"
              description="Surfline covers surf spots worldwide — from Indonesia to Portugal
                to Australia. Quiver currently focuses on US beaches (CA, HI, OR,
                WA, FL, East Coast, PR) and Baja. If you travel internationally
                to surf, Surfline has broader reach."
            />
          </FadeInSection>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Where Quiver Wins */}
      {/* ================================================================= */}
      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            Where Quiver Wins
          </h2>
          <p className="mt-2 font-sans text-muted-foreground">
            Here&apos;s where we believe Quiver delivers more value, especially
            if you surf US beaches regularly.
          </p>

          <FadeInSection className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <QuiverAdvantageCard
              icon={<Zap className="h-5 w-5" />}
              title="Free Forecasts"
              description="Every forecast feature is free today. No paywall on conditions
                ratings, no premium tier for detailed swell data. The
                forecast data you need to make the call shouldn't cost
                $100/year."
              badge="Free"
            />
            <QuiverAdvantageCard
              icon={<Zap className="h-5 w-5" />}
              title="Crowd-Sourced ML"
              description="Oracle combines machine learning with real surfer observations.
                Per-beach models trained on 30,000+ buoy readings bias-correct
                NOAA forecasts every 3 hours, while crowd-sourced session data
                keeps predictions grounded in reality — not just algorithms."
              badge="Oracle"
              href="/forecast-accuracy"
            />
            <QuiverAdvantageCard
              icon={<Users className="h-5 w-5" />}
              title="Crowd-Sourced Forecasting"
              description="Quiver's forecasts are built on real observations from the
                community. Surfers log conditions, report accuracy, and
                contribute to a living dataset that makes every forecast
                better. The more people surf with Quiver, the smarter it gets."
              badge="Community-powered"
            />
            <QuiverAdvantageCard
              icon={<Users className="h-5 w-5" />}
              title="Session Logging & Sharing"
              description="Log every session with conditions, photos, and notes. Share
                sessions with your crew through beautiful summary cards. Build
                your surf journal over time and track your progression."
              badge="Free journal"
              href="/sessions"
            />
            <QuiverAdvantageCard
              icon={<Users className="h-5 w-5" />}
              title="Community-First Approach"
              description="Follow surfers, build your crew, see what your friends are surfing.
                Quiver is built around the idea that surfing is better with your
                people. Surfline is a media company; Quiver is a community platform."
              badge="Crew feeds"
            />
            <QuiverAdvantageCard
              icon={<Shield className="h-5 w-5" />}
              title="Transparent Data"
              description="Quiver shows you exactly where forecast data comes from — NOAA,
                CDIP buoys, NDBC stations, Open-Meteo wind models. We show
                confidence scores and data source indicators. No black box."
              badge="Open data"
              href="/forecast-accuracy"
            />
          </FadeInSection>
        </div>
      </section>

      {/* ================================================================= */}
      {/* The Oracle Difference */}
      {/* ================================================================= */}
      <section className="border-y border-border bg-card/50 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            The Oracle Difference
          </h2>
          <p className="mt-4 font-sans text-base leading-relaxed text-muted-foreground md:text-lg">
            Most surf forecast apps show you the same raw NOAA data in different
            wrappers. The problem? NOAA&apos;s marine forecast is designed for
            open-ocean shipping, not individual surf breaks. A 4ft forecast at an
            offshore buoy might mean 2ft mush at a sheltered beach or 6ft barrels
            at an exposed reef.
          </p>
          <p className="mt-4 font-sans text-base leading-relaxed text-muted-foreground md:text-lg">
            Quiver&apos;s Oracle solves this with a crowd-sourced approach.
            For each of our 185+ beaches, we train ML models on thousands
            of historical observations from nearby CDIP, NDBC, and IOOS buoys.
            But what makes Oracle different is the crowd-sourced layer: real
            surfers logging{" "}
            <Link
              href="/sessions"
              className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              session data
            </Link>
            {" "}that validates and improves predictions over time. The more
            people surf with Quiver, the smarter every forecast gets.
          </p>
          <p className="mt-4 font-sans text-base leading-relaxed text-muted-foreground md:text-lg">
            The result: community-validated forecasts corrected for your exact
            beach, updated every 3 hours, with a{" "}
            <Link
              href="/forecast-accuracy"
              className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              publicly tracked accuracy record
            </Link>
            {" "}against real buoy measurements. Surfline&apos;s human forecasters
            bring valuable experience, but they can&apos;t crowd-source accuracy
            from every surfer at every break.
          </p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Detailed Feature Deep Dives */}
      {/* ================================================================= */}
      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            Feature Deep Dive
          </h2>

          <div className="mt-8 space-y-8">
            <FeatureDeepDive
              title="Surf Forecasts: Crowd-Sourced vs. Editorial"
              quiverApproach="Quiver combines per-beach ML models with real surfer
                observations. Models trained on buoy data bias-correct NOAA
                forecasts every 3 hours, while crowd-sourced session logs
                provide ground truth that keeps predictions honest. Every beach
                gets a personalized, community-validated model."
              surflineApproach="Surfline employs human forecasters who write narrative
                surf reports. Their forecasts include editorial context and local
                insight. Detailed conditions ratings and 'surf height' ranges
                require a $99.99/year Premium subscription."
              verdict="Quiver's crowd-sourced approach means more frequent updates
                validated by real surfers. Surfline's editorial touch adds
                narrative context but at a significant annual cost."
            />
<FeatureDeepDive
              title="Session Tracking: Journal vs. Basic"
              quiverApproach="Full surf journal with session logging, photo uploads,
                conditions recording, and social sharing. Share session summary
                cards with your crew. Track your progression over time with
                detailed session history. All free."
              surflineApproach="Session tracking feature available for logging
                surf sessions. Includes conditions data and basic session notes.
                Some features tied to premium."
              verdict="Both platforms offer session tracking. Quiver's community-oriented
                sharing and crew features give it an edge for surfers who want
                a social journal."
            />
            <FeatureDeepDive
              title="Crowd Data: Intelligence vs. General"
              quiverApproach="Crowd level data and optimal window analysis for each
                beach. Quiver identifies the best time to go based on crowd
                patterns and conditions. Free for every beach."
              surflineApproach="Crowd data and best-time-to-go features are
                part of the Surfline Premium subscription. Free tier shows basic
                conditions but gates crowd intelligence."
              verdict="Both platforms provide crowd data, but Quiver makes it free.
                If you're checking crowd levels to avoid the masses, you
                shouldn't have to pay for that information."
            />
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Who Should Use What */}
      {/* ================================================================= */}
      <section className="border-y border-border bg-card/50 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            Who Should Use What?
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-6">
              <h3 className="font-heading text-lg font-bold text-primary">
                Choose Quiver if you...
              </h3>
              <ul className="mt-4 space-y-3 font-sans text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span>Surf US beaches (CA, HI, OR, WA, FL, East Coast, PR)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span>Want accurate forecasts without paying a subscription</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span>Value crowd-sourced, data-driven accuracy over editorial narrative</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span>Want a clean, fast forecast check experience</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span>Want to log sessions and share with your crew</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span>Believe surf conditions data should be community-driven</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-background p-6">
              <h3 className="font-heading text-lg font-bold text-muted-foreground">
                Surfline might be better if you...
              </h3>
              <ul className="mt-4 space-y-3 font-sans text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span>Surf internationally and need global coverage</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span>Rely heavily on live surf cams for decision-making</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span>Prefer human-written forecast narratives</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span>Value brand familiarity and a 40-year track record</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span>
                    Don&apos;t mind paying $100/year for the full package
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FAQ Section */}
      {/* ================================================================= */}
      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 space-y-0 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {FAQ_ITEMS.map((faq) => (
              <details key={faq.question} className="group">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-sans text-sm font-semibold text-foreground hover:bg-background/50 [&::-webkit-details-marker]:hidden">
                  <span className="pr-4">{faq.question}</span>
                  <span className="flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 6l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Affiliation Disclosure */}
      {/* ================================================================= */}
      <section className="border-t border-border bg-card/30 px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-center text-xs text-muted-foreground">
            <strong>Disclosure:</strong> This page is published by Quiver. We have
            done our best to represent Surfline&apos;s features and pricing
            accurately based on publicly available information as of March 2026.
            Surfline is a trademark of Surfline/Wavetrak, Inc. Quiver is not
            affiliated with or endorsed by Surfline. Pricing and features may have
            changed since this page was last updated.
          </p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Internal Links — Browse Forecasts */}
      {/* ================================================================= */}
      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">
            Browse Free Forecasts
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Check out Quiver&apos;s crowd-sourced forecasts for popular breaks.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Blacks Beach", href: "/ca/san-diego/blacks" },
              { name: "Huntington Beach", href: "/ca/huntington-beach/huntington-beach" },
              { name: "Trestles", href: "/ca/san-clemente/trestles" },
              { name: "Pipeline", href: "/hi/north-shore/pipeline" },
              { name: "Rincon", href: "/ca/santa-barbara/rincon" },
              { name: "Ocean Beach SF", href: "/ca/san-francisco/ocean-beach" },
            ].map((beach) => (
              <Link
                key={beach.href}
                href={beach.href}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-card/80"
              >
                {beach.name}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
          <div className="mt-4 flex gap-4">
            <Link
              href="/forecast"
              className="text-sm font-semibold text-primary hover:underline"
            >
              View all 185+ beaches →
            </Link>
            <Link
              href="/forecast-accuracy"
              className="text-sm font-semibold text-primary hover:underline"
            >
              See our accuracy data →
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* CTA Section */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden px-4 py-16 md:py-20">
        {/* Background accent */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-emerald-600/5" />

        <FadeInSection className="relative mx-auto max-w-3xl text-center">
          <AnimatedStickerBadge className="mb-6">
            <StickerBadge>
              No credit card required
            </StickerBadge>
          </AnimatedStickerBadge>

          <h2 className="font-heading text-2xl font-bold sm:text-3xl md:text-4xl">
            Ready to check the forecast without the paywall?
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-muted-foreground md:text-lg">
            Join surfers who switched from Surfline Premium to Quiver&apos;s
            crowd-sourced forecasts. Set up in 30 seconds.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-heading text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Try Quiver Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/forecast"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 font-heading text-sm font-semibold text-foreground transition-colors hover:bg-card"
            >
              Browse Forecasts
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Free today. 185+ beaches. Crowd-sourced surf calls.
          </p>
        </FadeInSection>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function SurflineAdvantageCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <h3 className="font-heading text-base font-bold text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function QuiverAdvantageCard({
  icon,
  title,
  description,
  badge,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border border-primary/20 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h3 className="font-heading text-base font-bold text-foreground">
            {title}
          </h3>
        </div>
        <AnimatedStickerBadge className="flex-shrink-0">
          <StickerBadge className="text-[10px]">
            {badge}
          </StickerBadge>
        </AnimatedStickerBadge>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {href && (
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Learn more <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
  return content;
}

function FeatureDeepDive({
  title,
  quiverApproach,
  surflineApproach,
  verdict,
}: {
  title: string;
  quiverApproach: string;
  surflineApproach: string;
  verdict: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            Quiver&apos;s Approach
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {quiverApproach}
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Surfline&apos;s Approach
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {surflineApproach}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-background p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Our Take
        </p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/80">
          {verdict}
        </p>
      </div>
    </div>
  );
}
