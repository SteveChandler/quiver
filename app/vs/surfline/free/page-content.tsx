/**
 * Free Surfline Alternative Page
 *
 * SEO comparison page targeting "free surfline alternative" keywords.
 * Server component for full SEO indexability. Renders the cream/light
 * marketing comparison design (bg-[#F4EBD8]) with sticker-style badges
 * and a data-first layout.
 *
 * URL: /vs/surfline/free
 * ISR: 24 hours (86400s), static content updated infrequently
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  Compass,
  MapPinned,
  Minus,
  Shield,
  Star,
  Users,
  X,
  Zap,
} from "lucide-react";

import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
import { LiveCamCard } from "@/app/vs/surfline/free/live-cam-card";
import {
  FadeInSection,
  AnimatedStickerBadge,
  AnimatedFeatureRow,
  VsAnimationStyles,
} from "@/app/vs/surfline/animations";

// ISR: Revalidate every 24 hours (static comparison content)
export const revalidate = 86400;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = buildPageMetadata({
  title: "Free Surfline Alternative: Quiver",
  description:
    "Quiver is a free Surfline alternative: check 280+ US, Hawaii, Puerto Rico and Baja breaks with forecasts, tides, and live cams, no subscription required.",
  path: "/vs/surfline/free",
  keywords: [
    "free surfline alternative",
    "free alternative to surfline",
    "surfline free alternative",
    "free alternative to surfline premium",
    "no subscription surf forecast",
    "free surf forecast app",
    "free surf cams",
    "surfline premium alternative",
  ],
  image: "/api/og/guide?title=Free%20Surfline%20Alternative&region=Compare",
});

// ---------------------------------------------------------------------------
// Structured Data
// ---------------------------------------------------------------------------

const SITE_ORIGIN = SITE_URL;

// ---------------------------------------------------------------------------
// FAQ Data
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    question: "Is there a free alternative to Surfline?",
    answer:
      "Yes. With Quiver you can browse forecasts, tide charts, and live cams for 280+ breaks across the US, Hawaii, Puerto Rico, and Baja without a subscription. A Pro tier adds session-based personalization.",
  },
  {
    question: "Do I need a subscription to check surf on Quiver?",
    answer:
      "No. Reading conditions — forecast, tide, wind, and cams — is free. The optional Pro tier adds the personalization that learns from your logged sessions.",
  },
  {
    question: "What replaced Magic Seaweed?",
    answer:
      "Magic Seaweed was merged into Surfline. If you want a data-first replacement you can read without paying, Quiver covers US, Hawaii, Puerto Rico, and Baja breaks with forecasts, tides, and cams.",
  },
  {
    question: "Is Quiver more personal than Surfline?",
    answer:
      "Yes. Surfline is built around broad regional surf reports and spot forecasts. Quiver is built around your home beaches, logged sessions, condition reports, and surf preferences, so the product can become a personal forecaster for the waves you actually want to surf.",
  },
  {
    question: "What beaches does Quiver cover?",
    answer:
      "Quiver covers 279+ beaches across California, Hawaii, Oregon, Washington, Puerto Rico, Florida, the East Coast, and Baja Mexico. Every beach gets a forecast model, tide charts, crowd data, and session logging with no subscription required.",
  },
  {
    question: "Can I switch from Surfline to Quiver?",
    answer:
      "You can start using Quiver alongside Surfline immediately. There is nothing to cancel or migrate. Create an account, set your home beaches, log sessions, and see whether Quiver's personal surf calls fit your local routine.",
  },
  {
    question: "Is this page biased toward Quiver?",
    answer:
      "This is Quiver's website, so yes, we have a perspective. But we've tried to be honest about where Surfline fits: broad regional reports, global coverage, and a long-established surf forecast product. We believe the best way to earn trust is transparency, not spin. Pricing and feature notes were checked against public Surfline information on June 23, 2026.",
  },
  {
    question: "How accurate is Quiver compared to Surfline?",
    answer:
      "Quiver has not completed a same-sample comparison against Surfline, so it does not claim an accuracy ranking. The methodology page explains the identical beaches, timestamps, lead times, observations, and wave-height definitions a fair comparison requires.",
  },
  {
    question: "Does Quiver have surf cams?",
    answer:
      "Yes. Quiver includes live surf cams and regional cam pages where streams are available. Browse the surf cam directory to check real-time conditions alongside your forecast.",
  },
  {
    question: "What happened to Magic Seaweed? Is Quiver a replacement?",
    answer:
      "Magic Seaweed (MSW) merged into Surfline in May 2023, and many of its open forecast features moved behind Surfline's paywall. Quiver isn't a direct MSW clone, but if you liked MSW's data-first approach to surf forecasting, Quiver shares that philosophy: beach-specific forecasts, tide charts, and crowd data without a premium subscription.",
  },
  {
    question: "Does Quiver work for East Coast and Gulf surfers?",
    answer:
      "Yes. Quiver covers beaches across Florida, the Carolinas, New Jersey, New York, and other East Coast states, plus Gulf spots in Texas. East Coast and Gulf breaks get the same per-beach forecasts, tide charts, and water temperature data as our West Coast spots, with ML correction applied where a break is calibrated.",
  },
  {
    question: "Can I use Quiver on my phone?",
    answer:
      "Quiver works on any phone browser, no app store download needed. It's optimized for checking conditions before dawn: fast load times, dark theme, and the data you need at a glance. Add it to your home screen for an app-like experience.",
  },
];

// ---------------------------------------------------------------------------
// Feature Comparison Data
// ---------------------------------------------------------------------------

type FeatureStatus = "included" | "paid" | "partial" | "none";

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
    feature: "Forecast Style",
    description: "The shape of the daily surf decision",
    quiver: "included",
    quiverNote: "Personal calls for your beaches",
    surfline: "partial",
    surflineNote: "Regional reports and spot forecasts",
  },
  {
    feature: "Feedback Loop",
    description: "Whether your sessions sharpen the next call",
    quiver: "included",
    quiverNote: "Sessions, ratings, and reports",
    surfline: "none",
    surflineNote: "General spot reads",
  },
  {
    feature: "Live Cams",
    description: "Real-time visual checks where streams are available",
    quiver: "included",
    quiverNote: "Live cams and regional cam pages",
    surfline: "partial",
    surflineNote: "Cams in broader product",
  },
  {
    feature: "Session Media & Journal",
    description: "Logging, user-added media, ratings, and sharing",
    quiver: "included",
    quiverNote: "Photos, notes, ratings, crew sharing",
    surfline: "paid",
    surflineNote: "Premium + compatible watch for cam clips",
  },
  {
    feature: "Coverage",
    description: "Where the product is strongest",
    quiver: "included",
    quiverNote: "US, Puerto Rico, Baja focus",
    surfline: "partial",
    surflineNote: "Broader global coverage",
  },
  {
    feature: "Price",
    description: "Supporting evidence, not the main wedge",
    quiver: "included",
    quiverNote: "$0 today",
    surfline: "paid",
    surflineNote: "Varies by plan and region",
  },
  {
    feature: "Public roadmap",
    description: "Vote on what gets built next and submit requests.",
    quiver: "included",
    quiverNote: "Vote + submit",
    surfline: "none",
  },
];

const QUICK_DECISIONS = [
  {
    label: "Use Quiver",
    title: "If the question is your next session",
    body:
      "Home beaches, logged sessions, ratings, condition reports, crew context, and US/PR/Baja forecast coverage.",
    icon: <Star className="h-5 w-5" />,
    href: "/features",
  },
  {
    label: "Use Surfline",
    title: "If the question is the wider region",
    body:
      "Broad regional reports, global travel coverage, and an established daily surf-report routine.",
    icon: <MapPinned className="h-5 w-5" />,
  },
  {
    label: "Shared",
    title: "Both can support a visual check",
    body:
      "Quiver includes live surf cams and regional cam pages where streams are available.",
    icon: <Camera className="h-5 w-5" />,
    href: "/cams",
  },
];

const PROOF_ITEMS = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Personal calls",
    description: "Home beaches, ratings, session logs, and condition reports.",
    href: "/features",
  },
  {
    icon: <Activity className="h-5 w-5" />,
    title: "Transparent accuracy method",
    description:
      "We publish how we measure forecast accuracy — and don't claim lift until the buoy sample backs it.",
    href: "/forecast-accuracy",
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    title: "Session memory",
    description: "Every log becomes context for the next surf call.",
    href: "/sessions",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Crew context",
    description: "Reports and shared sessions from people near the water.",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Cams included",
    description: "Live cams and regional cam pages where streams are available.",
    href: "/cams",
  },
  {
    icon: <Compass className="h-5 w-5" aria-hidden />,
    title: "Built in the open",
    description:
      "Vote on what we build next — the roadmap is public and yours to shape.",
    href: "/roadmap",
  },
];

// Hardcoded so the hero "Updated" sticker stays in sync with the
// hardcoded "June 23, 2026" dates in the FAQ/disclosure/JSON-LD —
// new Date() would drift on this ISR-static page.
const PAGE_UPDATED = "Jun 2026";

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
    included: {
      icon: <Check className="h-4 w-4" />,
      text: "Included",
      classes: isQuiver
        ? "bg-[#F78E42] text-[#11100D] border-[#11100D]"
        : "bg-[#D6E7C7] text-[#11100D] border-[#11100D]",
    },
    paid: {
      icon: <span className="text-xs font-mono font-bold">$</span>,
      text: "Premium",
      classes: "bg-[#252D6B] text-[#F4EBD8] border-[#11100D]",
    },
    partial: {
      icon: <Minus className="h-4 w-4" />,
      text: "Partial",
      classes: "bg-[#F8EFD8] text-[#11100D] border-[#11100D]",
    },
    none: {
      icon: <X className="h-4 w-4" />,
      text: "No",
      classes: "bg-[#E6C3B6] text-[#11100D] border-[#11100D]",
    },
  }[status];

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-sm border-2 px-2 py-0.5 text-xs font-black uppercase shadow-[2px_2px_0_rgba(17,16,13,0.18)] ${config.classes}`}
      >
        {config.icon}
        {config.text}
      </span>
      {note && (
        <span className="max-w-[150px] text-center text-[11px] font-semibold leading-tight text-[#252D6B]">
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
      className={`inline-block rounded-sm border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-heading text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.28)] ${className}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function VsSurflineFreePage() {
  const camBeaches = await getBeachesWithCameras();
  const camCount = camBeaches.length;

  return (
    <>
      <VsAnimationStyles />
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: `${SITE_ORIGIN}/` },
          { name: "Compare", url: `${SITE_ORIGIN}/vs/surfline` },
          {
            name: "Free Surfline Alternative",
            url: `${SITE_ORIGIN}/vs/surfline/free`,
          },
        ]}
      />
      <FAQSchema items={FAQ_ITEMS} />

      <ZineSurface
        sectionLabel="Free Surfline alternative"
        editionLabel="No forecast paywall"
        data-testid="vs-surfline-free-zine-surface"
      >
        <main>
      {/* ================================================================= */}
      {/* Hero Section */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden px-4 pb-8 pt-8 md:pb-16 md:pt-16">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(17,16,13,0.22) 1px, transparent 0), linear-gradient(90deg, rgba(37,45,107,0.11) 1px, transparent 1px)",
            backgroundSize: "12px 12px, 76px 76px",
          }}
        />
        <div
          aria-hidden
          className="absolute right-0 top-8 hidden h-[88%] w-[43%] border-y-2 border-l-2 border-[#11100D] bg-[#252D6B] lg:block"
          style={{
            clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute left-0 top-24 hidden h-10 w-2/5 -rotate-[1.5deg] bg-[#F78E42] md:block"
        />

        <div className="relative mx-auto grid max-w-7xl gap-7 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)] lg:items-end">
          <div className="zine-measure relative space-y-5 md:space-y-7">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-10 right-2 hidden w-32 rotate-[5deg] opacity-90 lg:block"
            />
            <AnimatedStickerBadge>
              <StickerBadge>Updated {PAGE_UPDATED}</StickerBadge>
            </AnimatedStickerBadge>

            <div>
              <p className="mb-3 font-mono text-xs font-black uppercase tracking-[0.24em] text-[#9E5010]">
                Quiver vs Surfline · The Free Read
              </p>
              <h1 className="zine-h1 max-w-5xl font-heading font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                Looking for a free Surfline alternative?
              </h1>
              <p className="mt-5 max-w-2xl text-sm font-semibold leading-6 text-[#252D6B] md:mt-6 md:text-lg md:leading-7">
                Quiver lets you check 280+ breaks across the US coasts, Hawaii,
                Puerto Rico, and Baja — free, no subscription to read
                conditions. A Pro tier adds session-based personalization.
                Surfline is global but paywalls its forecasts.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] shadow-[5px_5px_0_rgba(17,16,13,0.3)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/forecast"
                className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#11100D] bg-[#F8EFD8] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] shadow-[5px_5px_0_rgba(17,16,13,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
              >
                Browse Forecasts
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-5">
              {[
                { n: "2.5M+", l: "forecasts crunched" }, // marketing constant — bump periodically
                { n: "280+", l: "breaks dialed in" }, // marketing constant — keep in sync with coverage
                { n: `${camCount}`, l: "live cams" }, // live: derived from getBeachesWithCameras()
              ].map((s, i) => (
                <div
                  key={s.l}
                  className={`bg-[#252D6B] text-[#F5EEDC] rounded-[12px_4px_14px_6px] shadow-[2px_3px_0_rgba(0,0,0,0.3)] px-3 py-3 ${["rotate-[-1deg]", "rotate-[1.2deg]", "rotate-[-0.6deg]"][i]}`}
                >
                  <div className="font-heading font-bold text-2xl leading-none">
                    {s.n}
                  </div>
                  <div className="font-mono text-[10px] tracking-wider uppercase text-[#00D4AA] mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FadeInSection delay={150} className="relative min-h-[340px] sm:min-h-[430px] lg:min-h-[560px]">
            <div className="absolute left-1 top-4 w-[76%] -rotate-[3deg] border-2 border-[#11100D] bg-[#F8EFD8] p-3 shadow-[9px_9px_0_rgba(17,16,13,0.28)] sm:left-0 sm:top-8 sm:w-[70%] sm:p-4">
              <div className="flex items-center justify-between border-b-2 border-[#11100D] pb-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#252D6B]">
                <span>Surfline</span>
                <span>Regional read</span>
              </div>
              <p className="mt-4 font-heading text-2xl font-black uppercase leading-none text-[#11100D] sm:mt-5 sm:text-3xl">
                Solid for the coast map.
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#252D6B] sm:mt-3 sm:text-sm sm:leading-6">
                Broad reports, travel scanning, and a familiar daily forecast
                habit.
              </p>
            </div>

            <div className="absolute bottom-0 right-0 w-[90%] rotate-[1.8deg] border-2 border-[#11100D] bg-[#252D6B] p-3 text-[#F4EBD8] shadow-[13px_13px_0_rgba(17,16,13,0.38)] sm:w-[78%] sm:p-4">
              <div className="flex items-center justify-between border-b-2 border-[#F78E42] pb-3 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#F78E42]">
                <span>Quiver Oracle</span>
                <span>Session-aware</span>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 sm:mt-5 sm:gap-4">
                <div>
                  <p className="font-heading text-3xl font-black uppercase leading-none sm:text-5xl">
                    Go early.
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#F4EBD8]/82 sm:text-sm sm:leading-6">
                    Your home beach likes a dropping tide. Last two rated
                    sessions were best before the wind turned.
                  </p>
                </div>
                <div className="flex h-20 w-20 rotate-[-8deg] flex-col items-center justify-center rounded-full border-4 border-[#F78E42] bg-[#F4EBD8] text-center text-[#11100D] shadow-[4px_4px_0_rgba(0,0,0,0.26)] sm:h-24 sm:w-24">
                  <span className="font-heading text-2xl font-black sm:text-3xl">7</span>
                  <span className="font-mono text-[10px] font-black uppercase tracking-[0.12em]">
                    am
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:mt-5">
                {[
                  ["Tide", "Dropping"],
                  ["Wind", "Light"],
                  ["Your logs", "+2"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border border-[#F78E42]/45 bg-[#11100D]/26 px-2 py-2"
                  >
                    <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-[#F78E42]">
                      {label}
                    </p>
                    <p className="mt-1 font-heading text-sm font-black text-[#F4EBD8]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ================================================================= */}
      {/* The Quick Take */}
      {/* ================================================================= */}
      <section className="relative px-4 py-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="relative -rotate-[0.6deg] border-2 border-[#11100D] bg-[#11100D] p-5 text-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.25)] md:p-7">
            <div className="absolute -top-4 left-7 rotate-[-2deg] border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#11100D]">
              the short answer
            </div>
            <p className="font-heading text-2xl font-black leading-tight md:text-4xl">
              Yes — Quiver is a free Surfline alternative for the US,
              Hawaii, Puerto Rico, and Baja. You read any beach&apos;s forecast,
              tide, and cams without paying. The personalization that learns your
              sessions is the optional Pro layer.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Who Should Use What */}
      {/* ================================================================= */}
      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="inline-flex border-2 border-[#11100D] bg-[#F78E42] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)]">
                pick your stack
              </p>
              <h2 className="mt-3 max-w-3xl font-heading text-4xl font-black leading-none text-[#11100D] md:text-6xl">
                One decision, three honest answers.
              </h2>
            </div>
            <p className="max-w-lg text-sm font-bold leading-6 text-[#252D6B] md:text-base">
              Cams are not the differentiator. Both apps can help you look at
              the water. The real difference is whether the forecast adapts to
              your sessions.
            </p>
          </div>

          <FadeInSection className="mt-7 grid gap-4 lg:grid-cols-3">
            {QUICK_DECISIONS.map((decision, index) => (
              <DecisionCard
                key={decision.label}
                decision={decision}
                index={index}
              />
            ))}
          </FadeInSection>

          <div className="flex items-center gap-3 bg-[#FFFDF7] border-2 border-[#11100D] rounded-[10px] px-4 py-3 mt-6">
            <div>
              <div className="font-heading font-bold text-[15px]">
                Get it on your phone
              </div>
              <span className="font-sans text-[11.5px] text-[#6b6557]">
                iOS live now · Android beta open
              </span>
            </div>
            <Link
              href="/app"
              className="ml-auto font-heading font-bold text-xs bg-[#11100D] text-[#F5EEDC] rounded-lg px-3 py-2"
            >
              Get the app
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Live Cam Wall */}
      {/* ================================================================= */}
      <section
        aria-labelledby="cam-wall-heading"
        className="px-4 pb-10 md:pb-14"
      >
        <div className="relative mx-auto max-w-7xl">
          <QuiverSticker
            sticker="breakingWave"
            className="absolute -right-2 -top-12 hidden w-28 rotate-[-4deg] opacity-90 lg:block"
          />
          <div className="flex items-baseline justify-between mb-3">
              <h2
                id="cam-wall-heading"
                className="font-mono text-[11px] tracking-[0.16em] font-bold uppercase text-[#252D6B]"
              >
                Watch any break · free
              </h2>
              <span className="font-mono text-[10px] text-[#6b6557]">
                {camCount} live cams
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {camBeaches.slice(0, 12).map((b) => (
                <LiveCamCard key={b.id} beach={b} />
              ))}
            </div>
            <Link
              href="/cams"
              className="inline-flex items-center gap-1 mt-3 font-heading font-bold text-sm text-[#F78E42]"
            >
              See all {camCount} cams →
            </Link>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Feature Comparison Table */}
      {/* ================================================================= */}
      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="relative rotate-[0.25deg] border-2 border-[#11100D] bg-[#F8EFD8] p-4 shadow-[9px_9px_0_rgba(17,16,13,0.22)] md:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-multiply"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(17,16,13,0.3) 1px, transparent 0)",
                backgroundSize: "9px 9px",
              }}
            />
            <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="font-heading text-4xl font-black leading-none text-[#11100D] md:text-5xl">
                  Comparison in 60 seconds.
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#252D6B]">
                  Pricing checked June 23, 2026. Surfline plans and prices can
                  vary by region, plan type, promotion, and app store billing.
                </p>
              </div>
              <Link
                href="/forecast-accuracy"
                className="inline-flex w-fit items-center gap-2 rounded-sm border-2 border-[#11100D] bg-[#252D6B] px-4 py-2 font-heading text-xs font-black uppercase tracking-[0.1em] text-[#F4EBD8] shadow-[4px_4px_0_rgba(17,16,13,0.24)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
              >
                How we measure accuracy
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Desktop Table */}
            <FadeInSection className="relative mt-6 hidden md:block">
              <div className="overflow-hidden border-2 border-[#11100D] bg-[#F4EBD8]">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#11100D] bg-[#11100D] text-[#F4EBD8]">
                    <th className="px-5 py-4 text-left font-heading font-black uppercase tracking-[0.08em]">
                      Feature
                    </th>
                    <th className="px-5 py-4 text-center font-heading font-black uppercase tracking-[0.08em] text-[#F78E42]">
                      Quiver
                    </th>
                    <th className="px-5 py-4 text-center font-heading font-black uppercase tracking-[0.08em] text-[#F4EBD8]">
                      Surfline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FEATURES.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-b-2 border-[#11100D] ${
                        i % 2 === 0 ? "bg-[#F4EBD8]" : "bg-[#EFE0C2]"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-heading text-base font-black text-[#11100D]">
                          {row.feature}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-[#252D6B]">
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

                </tbody>
              </table>
            </div>
          </FadeInSection>

          {/* Mobile Cards */}
          <div className="relative mt-6 space-y-3 md:hidden">
            {COMPARISON_FEATURES.map((row, i) => (
              <AnimatedFeatureRow key={row.feature} index={i}>
                <div className="border-2 border-[#11100D] bg-[#F4EBD8] p-4 shadow-[4px_4px_0_rgba(17,16,13,0.16)]">
                  <p className="font-heading text-lg font-black text-[#11100D]">
                    {row.feature}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[#252D6B]">
                    {row.description}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 font-mono text-[10px] font-black uppercase tracking-wider text-[#9E5010]">
                        Quiver
                      </p>
                      <StatusBadge
                        status={row.quiver}
                        note={row.quiverNote}
                        isQuiver
                      />
                    </div>
                    <div>
                      <p className="mb-1 font-mono text-[10px] font-black uppercase tracking-wider text-[#252D6B]">
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
          </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Where Quiver fits */}
      {/* ================================================================= */}
      <section className="px-4 py-10 md:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)] lg:items-start">
          <div className="relative border-2 border-[#11100D] bg-[#252D6B] p-6 text-[#F4EBD8] shadow-[9px_9px_0_rgba(17,16,13,0.26)] md:p-8">
            <QuiverSticker
              sticker="navyLightning"
              className="absolute -right-4 -top-6 hidden w-20 rotate-[8deg] drop-shadow-md sm:block"
            />
            <AnimatedStickerBadge className="mb-5">
              <StickerBadge>Why personal matters</StickerBadge>
            </AnimatedStickerBadge>
            <h2 className="font-heading text-4xl font-black leading-none md:text-6xl">
              Your beach does weird stuff.
            </h2>
            <p className="mt-5 text-base font-semibold leading-7 text-[#F4EBD8]/84 md:text-lg">
              NOAA data is open-ocean input. A 4ft offshore reading might mean
              2ft mush at a sheltered beach or 6ft surf at an exposed reef.
              Quiver publishes its accuracy methodology, including what buoy
              checks can establish and where they stop.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/forecast-accuracy"
                className="inline-flex items-center gap-2 rounded-sm border-2 border-[#F78E42] bg-[#F78E42] px-4 py-2 font-heading text-xs font-black uppercase tracking-[0.1em] text-[#11100D] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
              >
                How we measure accuracy
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sessions"
                className="inline-flex items-center gap-2 rounded-sm border-2 border-[#F4EBD8] px-4 py-2 font-heading text-xs font-black uppercase tracking-[0.1em] text-[#F4EBD8] transition-transform hover:-translate-y-0.5 hover:bg-[#F4EBD8] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBD8]"
              >
                Log sessions
              </Link>
            </div>
          </div>

          <FadeInSection className="space-y-3">
            {PROOF_ITEMS.map((item, index) => (
              <ProofRow key={item.title} item={item} index={index} />
            ))}
          </FadeInSection>
        </div>
      </section>


      {/* ================================================================= */}
      {/* FAQ Section */}
      {/* ================================================================= */}
      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-4xl font-black leading-none text-[#11100D] md:text-5xl">
            FAQ, no fluff.
          </h2>
          <div className="mt-6 divide-y-2 divide-[#11100D] overflow-hidden border-2 border-[#11100D] bg-[#F8EFD8] shadow-[7px_7px_0_rgba(17,16,13,0.2)]">
            {FAQ_ITEMS.map((faq) => (
              <details key={faq.question} className="group">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-sans text-sm font-black text-[#11100D] hover:bg-[#F78E42]/20 [&::-webkit-details-marker]:hidden">
                  <span className="pr-4">{faq.question}</span>
                  <span className="flex-shrink-0 text-[#252D6B] transition-transform duration-200 group-open:rotate-180">
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
                <div className="px-5 pb-4 text-sm font-semibold leading-relaxed text-[#252D6B]">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Internal Links: Browse Forecasts */}
      {/* ================================================================= */}
      <section className="px-4 pb-16 pt-8 md:pb-20">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)] lg:items-start">
          <div className="border-2 border-[#11100D] bg-[#11100D] p-6 text-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.26)] md:p-8">
            <h2 className="font-heading text-4xl font-black leading-none md:text-6xl">
              Ready for a more personal surf call?
            </h2>
            <p className="mt-4 text-base font-semibold leading-7 text-[#F4EBD8]/84 md:text-lg">
              Create an account, set your home beaches, log sessions, and
              help Quiver learn what makes a wave worth it for you.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#F78E42] bg-[#F78E42] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] shadow-[5px_5px_0_rgba(0,0,0,0.26)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
              >
                Start Your Personal Forecast
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/forecast"
                className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#F4EBD8] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#F4EBD8] transition-transform hover:-translate-y-0.5 hover:bg-[#F4EBD8] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBD8]"
              >
                Browse Forecasts
              </Link>
            </div>
            <p className="mt-5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#F78E42]">
              279 beaches. Forecasts included. Live cams where available. Works on any phone.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: "Blacks Beach", href: "/ca/san-diego/blacks" },
              { name: "Huntington Beach", href: "/ca/huntington-beach" },
              { name: "Lower Trestles", href: "/ca/san-onofre/lower-trestles" },
              { name: "Pipeline", href: "/hi/haleiwa/pipeline" },
              { name: "Rincon", href: "/ca/carpinteria/rincon-carpinteria-ca" },
              {
                name: "Ocean Beach SF",
                href: "/ca/san-francisco/ocean-beach-middle-san-francisco-ca",
              },
            ].map((beach) => (
              <Link
                key={beach.href}
                href={beach.href}
                className="group flex items-center justify-between border-2 border-[#11100D] bg-[#F8EFD8] px-4 py-3 font-heading text-base font-black text-[#11100D] shadow-[4px_4px_0_rgba(17,16,13,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
              >
                {beach.name}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
            <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
              <QuickTextLink href="/forecast">All 279 beaches</QuickTextLink>
              <QuickTextLink href="/best-time-to-surf">Best surf windows</QuickTextLink>
              <QuickTextLink href="/features">Quiver features</QuickTextLink>
              <QuickTextLink href="/cams">Live cams</QuickTextLink>
              <QuickTextLink href="/roadmap">Vote on the roadmap</QuickTextLink>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Keep Reading: Learn Cluster Rail */}
      {/* ================================================================= */}
      <section className="px-4 pb-16 md:pb-20">
        <div className="mx-auto max-w-7xl border-2 border-[#11100D] bg-[#F8EFD8] p-5 shadow-[6px_6px_0_rgba(17,16,13,0.2)] md:p-7">
          <p className="inline-flex border-2 border-[#11100D] bg-[#252D6B] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#F4EBD8] shadow-[2px_2px_0_rgba(17,16,13,0.22)]">
            Keep reading
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <QuickTextLink href="/learn/how-to-read-surf-conditions">
              How to read a surf report
            </QuickTextLink>
            <QuickTextLink href="/learn/groundswell-vs-wind-swell">
              Groundswell vs wind swell
            </QuickTextLink>
            <QuickTextLink href="/learn/how-accurate-are-surf-forecasts">
              How accurate are surf forecasts?
            </QuickTextLink>
            <QuickTextLink href="/vs/surfline">
              The full Quiver vs Surfline breakdown
            </QuickTextLink>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Affiliation Disclosure */}
      {/* ================================================================= */}
      <section className="px-4 pb-8">
        <div className="mx-auto max-w-7xl border-y-2 border-[#11100D] py-4">
          <p className="text-center text-xs font-semibold leading-5 text-[#252D6B]">
            <strong>Disclosure:</strong>{" "}
            This page is published by Quiver. We have done our best to represent
            Surfline&apos;s features and pricing
            accurately based on publicly available information checked on June 23, 2026.
            Surfline is a trademark of Surfline/Wavetrak, Inc. Quiver is not
            affiliated with or endorsed by Surfline. Pricing and features may have
            changed since this page was last updated.
          </p>
        </div>
      </section>
        </main>
      </ZineSurface>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function DecisionCard({
  decision,
  index,
}: {
  decision: (typeof QUICK_DECISIONS)[number];
  index: number;
}) {
  const rotations = ["rotate-[-0.7deg]", "rotate-[0.45deg]", "rotate-[-0.2deg]"];

  const content = (
    <div
      className={`h-full border-2 border-[#11100D] bg-[#F8EFD8] p-5 shadow-[6px_6px_0_rgba(17,16,13,0.22)] ${rotations[index]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42] text-[#11100D]">
          {decision.icon}
        </span>
        <span className="border-2 border-[#11100D] bg-[#11100D] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#F4EBD8]">
          {decision.label}
        </span>
      </div>
      <h3 className="mt-5 font-heading text-2xl font-black leading-none text-[#11100D]">
        {decision.title}
      </h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#252D6B]">
        {decision.body}
      </p>
      {decision.href && (
        <Link
          href={decision.href}
          className="mt-4 inline-flex items-center gap-1 font-heading text-xs font-black uppercase tracking-[0.1em] text-[#9E5010] hover:underline"
        >
          See it <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );

  return content;
}

function QuickTextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#9E5010] hover:underline"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function ProofRow({
  item,
  index,
}: {
  item: (typeof PROOF_ITEMS)[number];
  index: number;
}) {
  const row = (
    <div className="flex gap-4 border-2 border-[#11100D] bg-[#F8EFD8] p-4 shadow-[5px_5px_0_rgba(17,16,13,0.18)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42] text-[#11100D]">
        {item.icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#9E5010]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="font-heading text-lg font-black leading-tight text-[#11100D]">
            {item.title}
          </h3>
        </div>
        <p className="mt-1 text-sm font-semibold leading-5 text-[#252D6B]">
          {item.description}
        </p>
      </div>
    </div>
  );

  if (!item.href) return row;

  const content = (
    <Link
      href={item.href}
      className="block transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
    >
      {row}
    </Link>
  );

  return content;
}
