/**
 * Water Quality Check Tool
 *
 * Route: /tools/water-quality
 * Server component. Reads ?beach= param to show a specific beach's water quality.
 * Coverage: CA + HI only (CEDEN + PacIOOS data sources).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from "lucide-react";

import { buildPageMetadata } from "@/lib/seo/meta";
import {
  getBeachWaterQuality,
  getBeachesWithWaterQuality,
} from "@/actions/tools/water-quality-actions";
import { WQ_STATUS, EPA_BEACH_CRITERIA } from "@/lib/constants/water-quality";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { ToolShareButton } from "@/components/tools/tool-share-button";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { FAQSchema } from "@/components/seo/faq-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { ToolHero } from "@/components/tools/tool-hero";
import { TOOL_IMAGES } from "@/lib/constants/tool-images";
import { WaterQualitySearch } from "./water-quality-search";
import { WaterQualityMapList } from "@/components/tools/water-quality-map-list";
import type { WQStatus } from "@/lib/constants/water-quality";

export const revalidate = 3600;

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Water Quality Check — Is It Safe to Surf?",
    description:
      "Check bacteria levels before you paddle out. Real water quality data from EPA monitoring stations for California and Hawaii beaches.",
    path: "/tools/water-quality",
    image: "/images/tools/kelp-forest.jpg",
    keywords: [
      "water quality beach",
      "is it safe to swim",
      "bacteria levels beach",
      "safe to surf after rain",
      "beach water quality",
    ],
  });
}

const FAQ_ITEMS = [
  {
    question: "Is it safe to surf after rain?",
    answer:
      "After rain, bacteria levels typically spike 24–72 hours near storm drains and river mouths as runoff washes pollutants into the ocean. We recommend avoiding contact for at least 72 hours after significant rain near urban beaches.",
  },
  {
    question: "What bacteria levels are unsafe for surfing?",
    answer: `The EPA threshold for enterococcus — the primary ocean water quality indicator — is ${EPA_BEACH_CRITERIA.enterococcus.stv} CFU/100mL as a single-sample maximum. A 30-day geometric mean above ${EPA_BEACH_CRITERIA.enterococcus.geometricMean} CFU/100mL also indicates poor water quality.`,
  },
  {
    question: "Where does the water quality data come from?",
    answer:
      "California data comes from CEDEN (California Environmental Data Exchange Network), updated bi-weekly. Hawaii data comes from PacIOOS ERDDAP (Hawaii Department of Health Clean Water Branch). Both are sourced from official EPA monitoring programs.",
  },
  {
    question: "Why is only California and Hawaii covered?",
    answer:
      "We currently sync data from CEDEN (CA) and PacIOOS ERDDAP (HI) because they provide standardized, machine-readable beach monitoring APIs. We're working to add more states as additional data sources become available.",
  },
];

function StatusBadge({ status }: { status: WQStatus }) {
  const config = {
    [WQ_STATUS.GOOD]: {
      label: "GOOD",
      bg: "bg-emerald-500",
      text: "text-white",
      Icon: CheckCircle,
    },
    [WQ_STATUS.ADVISORY]: {
      label: "ADVISORY",
      bg: "bg-amber-400",
      text: "text-amber-900",
      Icon: AlertTriangle,
    },
    [WQ_STATUS.CLOSURE]: {
      label: "CLOSURE",
      bg: "bg-red-500",
      text: "text-white",
      Icon: XCircle,
    },
    [WQ_STATUS.UNKNOWN]: {
      label: "UNKNOWN",
      bg: "bg-slate-400",
      text: "text-white",
      Icon: HelpCircle,
    },
  };

  const { label, bg, text, Icon } = config[status] ?? config[WQ_STATUS.UNKNOWN];

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-lg ${bg} ${text}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </div>
  );
}

function StatusMessage({
  status,
  beachName,
  date,
}: {
  status: WQStatus;
  beachName: string;
  date: string | null;
}) {
  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const messages: Record<WQStatus, string> = {
    [WQ_STATUS.GOOD]: `Water quality is within safe limits at ${beachName}.${formattedDate ? ` Last tested ${formattedDate}.` : ""}`,
    [WQ_STATUS.ADVISORY]: `Elevated bacteria levels detected at ${beachName}. Consider avoiding water contact, especially with open wounds.${formattedDate ? ` Last tested ${formattedDate}.` : ""}`,
    [WQ_STATUS.CLOSURE]: `Health advisory in effect at ${beachName}. Water contact not recommended.${formattedDate ? ` Last updated ${formattedDate}.` : ""}`,
    [WQ_STATUS.UNKNOWN]: `No recent test data available for ${beachName}. Check back after the next monitoring cycle.`,
  };

  return (
    <p className="text-slate-600 text-base leading-relaxed">
      {messages[status]}
    </p>
  );
}

function MetricBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-mono">
          {value.toFixed(0)} / {max} CFU/100mL
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ beach?: string }>;
}

export default async function WaterQualityPage({ searchParams }: PageProps) {
  const { beach: beachSlug } = await searchParams;

  const [wqResult, allBeachesResult] = await Promise.all([
    beachSlug
      ? getBeachWaterQuality(beachSlug)
      : Promise.resolve({ success: true, data: null }),
    getBeachesWithWaterQuality(),
  ]);

  const wq = wqResult.success ? wqResult.data : null;
  const allBeaches = allBeachesResult.success
    ? (allBeachesResult.data ?? [])
    : [];

  return (
    <div className="min-h-screen" style={{ background: "#0F1535" }}>
      <FAQSchema items={FAQ_ITEMS} />
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Surfer's Toolkit", url: `${SITE_ORIGIN}/tools` },
          {
            name: "Water Quality Check",
            url: `${SITE_ORIGIN}/tools/water-quality`,
          },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Quiver Water Quality Check",
            url: `${SITE_ORIGIN}/tools/water-quality`,
            description:
              "Check bacteria levels before you paddle out. Real water quality data from EPA monitoring stations for California and Hawaii beaches.",
            applicationCategory: "SportsApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            publisher: {
              "@type": "Organization",
              name: "Quiver",
              url: SITE_ORIGIN,
            },
          }),
        }}
      />

      <ToolHero
        imageSrc={TOOL_IMAGES["water-quality"]}
        imageAlt="Kelp forest underwater near a coastal surf zone."
        title="Water Quality Check"
        description="Check bacteria levels before you paddle out. Updated from EPA monitoring stations. Currently covers CA & HI."
      />

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Beach Search */}
        <ScrollReveal>
          <div className="mb-8">
            <WaterQualitySearch placeholder="Search for a CA or HI beach..." />
          </div>
        </ScrollReveal>

        {/* Beach Result */}
        {wq ? (
          <ScrollReveal>
            <div className="mb-8 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              {/* Status Banner */}
              <div
                className={`p-6 border-b border-white/10 ${
                  wq.status === WQ_STATUS.GOOD
                    ? "bg-emerald-900/30"
                    : wq.status === WQ_STATUS.ADVISORY
                      ? "bg-amber-900/30"
                      : wq.status === WQ_STATUS.CLOSURE
                        ? "bg-red-900/30"
                        : "bg-slate-800/30"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">
                      {wq.beachName}
                    </h2>
                    {wq.city && (
                      <p className="text-slate-400 text-sm">
                        {wq.city}, {wq.state}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <ToolShareButton
                      toolName="Water Quality Check"
                      beachName={wq.beachName}
                      shareText={
                        wq.county_advisory_status === "unavailable"
                          ? `Current county water quality status could not be verified for ${wq.beachName} — check the county before entering the water`
                        : wq.status === WQ_STATUS.GOOD
                          ? `Water quality is good at ${wq.beachName} — safe to paddle out`
                          : wq.status === WQ_STATUS.ADVISORY
                            ? `Water quality advisory at ${wq.beachName} — check before you paddle out`
                            : wq.status === WQ_STATUS.CLOSURE
                              ? `Water quality closure at ${wq.beachName} — avoid water contact`
                              : `Check water quality at ${wq.beachName} on Quiver`
                      }
                    />
                    {wq.county_advisory_status === "clear" || wq.county_advisory_status === "unavailable" ? (
                      <span className="text-sm text-slate-300">{wq.county_advisory_status === "clear" ? "No current county advisory" : "County status unavailable"}</span>
                    ) : <StatusBadge status={wq.status} />}
                  </div>
                </div>
                <div className="mt-4">
                  {wq.county_advisory_status ? (
                    <p className="text-sm text-slate-300">
                      <a href="https://www.sdbeachinfo.com/" className="underline">Check current County of San Diego advisories</a>.
                      {wq.county_checked_at ? ` Checked ${new Date(wq.county_checked_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific. No advisory does not guarantee safe water.` : " Current status could not be verified. Check before entering the water."}
                    </p>
                  ) : <StatusMessage
                    status={wq.status}
                    beachName={wq.beachName}
                    date={wq.latestSampleDate}
                  />}
                </div>
              </div>

              {/* Metrics */}
              {(wq.latestEnterococcus !== null ||
                wq.latestFecalColiform !== null) && (
                <div className="p-6 space-y-6">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                    Latest Test Results
                  </h3>

                  <div className="space-y-4">
                    {wq.latestEnterococcus !== null && (
                      <MetricBar
                        value={wq.latestEnterococcus}
                        max={wq.epaEnterococcusSTV}
                        label={`Enterococcus (EPA limit: ${wq.epaEnterococcusSTV} CFU/100mL)`}
                      />
                    )}
                    {wq.latestFecalColiform !== null && (
                      <MetricBar
                        value={wq.latestFecalColiform}
                        max={wq.epaFecalColiformSTV}
                        label={`Fecal Coliform (EPA limit: ${wq.epaFecalColiformSTV} CFU/100mL)`}
                      />
                    )}
                  </div>

                  {/* 30-day trend */}
                  {wq.totalSamples30d > 0 && (
                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">
                          30-day exceedances
                        </span>
                        <span className="font-mono text-white">
                          {wq.exceedanceCount30d} / {wq.totalSamples30d} samples
                        </span>
                      </div>
                      <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            wq.exceedanceCount30d === 0
                              ? "bg-emerald-500"
                              : wq.exceedanceCount30d / wq.totalSamples30d > 0.5
                                ? "bg-red-500"
                                : "bg-amber-400"
                          }`}
                          style={{
                            width: `${Math.min(100, (wq.exceedanceCount30d / wq.totalSamples30d) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rain advisory */}
              <div className="px-6 pb-6">
                <div className="rounded-xl bg-blue-900/30 border border-blue-700/30 p-4">
                  <p className="text-sm text-blue-200 font-medium mb-1">
                    Rain Advisory
                  </p>
                  <p className="text-xs text-blue-300">
                    Bacteria levels typically spike 24–72 hours after rain,
                    especially near storm drains and river mouths. Avoid surfing
                    near these areas for 72 hours after significant rainfall.
                  </p>
                </div>
              </div>

              {/* Footer: CTA + disclosure */}
              <div className="px-6 pb-6 space-y-3">
                <Link
                  href={`/beach/${wq.beachSlug}`}
                  className="block w-full text-center py-3 rounded-xl bg-ocean-blue text-white font-semibold hover:bg-ocean-blue/90 transition-colors"
                >
                  See full conditions at {wq.beachName}
                </Link>
                <p className="text-xs text-slate-500 text-center">
                  Data from {wq.state === "HI" ? "PacIOOS ERDDAP" : "CEDEN"}.
                  Monitoring stations may not be at your exact surf spot. Levels
                  can change rapidly after rain.
                </p>
              </div>
            </div>
          </ScrollReveal>
        ) : beachSlug ? (
          <ScrollReveal>
            <div className="mb-8 rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
              <HelpCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h2 className="text-white font-semibold mb-2">
                No water quality data for this beach
              </h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                This beach either isn&apos;t in our monitoring network or
                hasn&apos;t been tested recently. Water quality data is
                currently available for California and Hawaii beaches only.
              </p>
            </div>
          </ScrollReveal>
        ) : null}

        {/* Map / Beach List */}
        {allBeaches.length > 0 && (
          <ScrollReveal>
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">
                All Monitored Beaches
              </h2>
              <WaterQualityMapList
                beaches={allBeaches}
                currentSlug={beachSlug}
              />
            </div>
          </ScrollReveal>
        )}

        {/* FAQ */}
        <ScrollReveal>
          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className="rounded-xl bg-white/5 border border-white/10 overflow-hidden group"
                >
                  <summary className="px-5 py-4 text-white font-medium cursor-pointer list-none flex items-center justify-between gap-3 hover:bg-white/5 transition-colors">
                    <span>{item.question}</span>
                    <span className="text-slate-400 shrink-0 group-open:rotate-180 transition-transform">
                      ▾
                    </span>
                  </summary>
                  <div className="px-5 pb-4 text-slate-300 text-sm leading-relaxed">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* Coverage disclosure */}
        <ScrollReveal>
          <div className="mb-8 rounded-xl bg-white/5 border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
              Data Sources &amp; Coverage
            </h3>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>
                <span className="text-white font-medium">California:</span>{" "}
                CEDEN (California Environmental Data Exchange Network) — updated
                bi-weekly
              </li>
              <li>
                <span className="text-white font-medium">Hawaii:</span> PacIOOS
                ERDDAP (Hawaii DOH Clean Water Branch) — updated bi-weekly
              </li>
              <li className="pt-1 text-slate-500">
                More states coming soon. Monitoring stations may not be at your
                exact surf spot.
              </li>
            </ul>
          </div>
        </ScrollReveal>

        {/* InlineSignupCta wrapped in dark container to match page background */}
        <div
          className="mb-8 rounded-2xl p-px"
          style={{
            background:
              "linear-gradient(135deg, rgba(247,142,66,0.3) 0%, rgba(64,76,146,0.4) 100%)",
          }}
        >
          <div className="rounded-2xl" style={{ background: "#1A2158" }}>
            <InlineSignupCta
              title="Clean water + the right window"
              description="You just checked the water. Pick your home beach and we'll score every hour by tide, wind, and swell — free."
              primaryButtonText="Pick your home beach"
              source="water-quality-tool-inline"
              ctaCopyVariant="tool_specific_v1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
