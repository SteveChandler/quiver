/**
 * Quiver vs Surfline Comparison Page
 *
 * SEO comparison page targeting "surfline alternative" keywords.
 * Server component for full SEO indexability. Uses the retro-dark
 * design system with sticker-style badges and data-first layout.
 *
 * URL: /vs/surfline
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
import {
  FadeInSection,
  AnimatedStickerBadge,
  AnimatedFeatureRow,
  VsAnimationStyles,
} from "./animations";

// ISR: Revalidate every 24 hours (static comparison content)
export const revalidate = 86400;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = buildPageMetadata({
  title: "Surfline Alternative: Quiver vs Surfline",
  description:
    "Compare Quiver and Surfline on surf forecasts, cams, tide charts, session logs, accuracy transparency, and when each app fits.",
  path: "/vs/surfline",
  keywords: [
    "surfline alternative",
    "surfline vs quiver",
    "personal surf forecaster",
    "regional surf reports",
    "best surf forecast app",
    "surf forecast app comparison",
    "quiver surf app",
    "surfline premium alternative",
  ],
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
];

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function getPageUpdatedDate(): string {
  return DATE_FORMATTER.format(new Date());
}

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

export default function VsSurflinePage() {
  const pageUpdatedDate = getPageUpdatedDate();

  return (
    <>
      <VsAnimationStyles />
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Compare", url: `${SITE_ORIGIN}/vs/surfline` },
          { name: "Quiver vs Surfline", url: `${SITE_ORIGIN}/vs/surfline` },
        ]}
      />
      <FAQSchema items={FAQ_ITEMS} />

      <ZineSurface
        sectionLabel="Compare"
        editionLabel="Quiver vs Surfline"
        data-testid="vs-surfline-zine-surface"
      >
        <main className="overflow-hidden text-[#11100D]">
      {/* ================================================================= */}
      {/* Hero Section */}
      {/* ================================================================= */}
      <section className="relative px-4 pb-8 pt-8 md:pb-16 md:pt-16">
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
          <div className="space-y-5 md:space-y-7">
            <AnimatedStickerBadge>
              <StickerBadge>Updated {pageUpdatedDate}</StickerBadge>
            </AnimatedStickerBadge>

            <div>
              <p className="mb-3 font-mono text-xs font-black uppercase tracking-[0.24em] text-[#9E5010]">
                Quiver vs Surfline
              </p>
              <h1 className="max-w-5xl font-heading text-4xl font-black leading-[0.9] tracking-normal text-[#11100D] sm:text-6xl md:text-7xl lg:text-8xl">
                Surfline Alternative: Quiver vs Surfline
              </h1>
              <p className="mt-5 max-w-2xl text-base font-black leading-7 text-[#252D6B] md:mt-6 md:text-2xl md:leading-9">
                Surfline helps you read the region. Quiver helps forecast your
                session.
              </p>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#252D6B] md:mt-4 md:text-lg md:leading-7">
                Set your home beaches, log what you actually surf, and turn each
                rating into a sharper call for next time, without making price
                the whole story.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] shadow-[5px_5px_0_rgba(17,16,13,0.3)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
              >
                Start Your Personal Forecast
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/forecast"
                className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#11100D] bg-[#F8EFD8] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] shadow-[5px_5px_0_rgba(17,16,13,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
              >
                Browse Forecasts
              </Link>
            </div>

            <Link
              href="/vs/surfline/free"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#252D6B] underline-offset-4 transition-colors hover:text-[#F78E42] hover:underline"
            >
              On a budget? See the no-subscription rundown
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/best-surf-forecast-app"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#252D6B] underline-offset-4 transition-colors hover:text-[#F78E42] hover:underline"
            >
              Choosing tools? Compare surf forecast apps by job
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <FadeInSection delay={150} className="relative min-h-[340px] sm:min-h-[430px] lg:min-h-[560px]">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-6 right-6 z-10 hidden w-32 rotate-6 opacity-85 sm:block"
            />
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
            <QuiverSticker
              sticker="halftoneCircle"
              className="absolute -right-5 -top-7 z-10 hidden w-20 rotate-[8deg] opacity-90 md:block"
            />
            <div className="absolute -top-4 left-7 rotate-[-2deg] border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#11100D]">
              quick read
            </div>
            <p className="font-heading text-2xl font-black leading-tight md:text-4xl">
              If you want to scan a coastline, Surfline fits. If you want the
              app to learn your home breaks and your taste in waves, Quiver is
              the sharper bet.
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
            <QuiverSticker
              sticker="spotSwellMatch"
              className="absolute -right-4 -top-6 z-10 hidden w-20 rotate-6 drop-shadow-md md:block"
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
              className="absolute -right-5 -top-6 z-10 hidden w-16 rotate-[10deg] drop-shadow-md md:block"
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
          <div className="relative border-2 border-[#11100D] bg-[#11100D] p-6 text-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.26)] md:p-8">
            <QuiverSticker
              sticker="creamCoastMap"
              className="absolute -right-5 -top-7 z-10 hidden w-24 rotate-[6deg] opacity-90 md:block"
            />
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
            </div>
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
