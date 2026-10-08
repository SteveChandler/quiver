"use client";

import { useCallback, useState } from "react";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker } from "@/components/zine";
import { resolvePreviewSlug } from "@/components/embed-promo/beach-selection";
import { SITE_URL } from "@/lib/constants/seo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BeachOption {
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
}

type WidgetType = "conditions" | "tides";

interface BusinessesEmbedPromoProps {
  /** Pre-fetched beach options for the dropdown */
  beaches: BeachOption[];
  /** Validated beach slug selected by the server page */
  initialSlug?: string;
}

interface ValueProp {
  icon: LucideIcon;
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants (content preserved from the shared EmbedPromoPage `businesses` variant)
// ---------------------------------------------------------------------------

const VALUE_PROPS: ValueProp[] = [
  {
    icon: RefreshCw,
    title: "Always Current",
    description:
      "Wave height, wind, tide, and water temp update automatically from NOAA and live buoy data.",
  },
  {
    icon: Code2,
    title: "No Code Needed",
    description:
      "Copy one line of HTML. Paste it into any website builder, CMS, or raw HTML page.",
  },
  {
    icon: Zap,
    title: "Free, No API Keys",
    description:
      "No keys to manage, no rate limits, no subscriptions. Powered by Quiver's open forecast engine.",
  },
];

const COPY = {
  heroTitle: "Free Beach Conditions Widget",
  heroSubtitle:
    "Keep customers informed with live wave, wind, and tide data on your website. Perfect for hotels, restaurants, and rental shops near the beach.",
  socialProofTitle: "Built for Coastal Businesses",
  socialProofBody:
    "Hotels, beachfront restaurants, and vacation rental sites embed Quiver widgets to help guests plan around the surf. No maintenance required — data stays current automatically.",
  ctaTitle: "Get Your Free Widget",
  ctaBody:
    "Select your beach above, copy the embed code, and paste it into your website. It takes less than 60 seconds.",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmbedCode(slug: string, widgetType: WidgetType): string {
  const src = `${SITE_URL}/embed/${widgetType}/${slug}`;
  const height = widgetType === "tides" ? "400" : "320";
  return `<iframe src="${src}" width="100%" height="${height}" style="border:none;border-radius:12px;" loading="lazy" title="Quiver ${widgetType === "tides" ? "Tide Chart" : "Surf Conditions"}"></iframe>`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MockBrowserWindow({
  slug,
  widgetType,
}: {
  slug: string;
  widgetType: WidgetType;
}) {
  const src = `${SITE_URL}/embed/${widgetType}/${slug}`;
  const height = widgetType === "tides" ? 400 : 320;

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Browser chrome — intentionally renders as a generic external site */}
      <div className="flex items-center gap-2 rounded-t-xl border-2 border-b-0 border-[#11100D] bg-[#252D6B] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#F78E42]" />
          <div className="h-3 w-3 rounded-full bg-[#F2C94C]" />
          <div className="h-3 w-3 rounded-full bg-[#7FA7B8]" />
        </div>
        <div className="ml-3 flex-1">
          <div className="truncate rounded-md bg-[#1A1535] px-3 py-1 font-mono text-xs text-[#F4EBD8]/70">
            your-website.com
          </div>
        </div>
      </div>
      {/* Browser body with iframe */}
      <div className="rounded-b-xl border-2 border-t-0 border-[#11100D] bg-[#FBF6E8] p-4 shadow-[3px_4px_0_rgba(17,16,13,0.25)]">
        <iframe
          src={src}
          width="100%"
          height={height}
          style={{ border: "none", borderRadius: 12 }}
          loading="lazy"
          title="Widget preview"
        />
      </div>
    </div>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border-2 border-[#F4EBD8]/70 bg-[#F4EBD8] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D] transition-transform hover:-translate-y-0.5 focus-ring"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-[#2D357D]" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden />
          Copy Code
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BusinessesEmbedPromo({
  beaches,
  initialSlug,
}: BusinessesEmbedPromoProps) {
  const [selectedSlug, setSelectedSlug] = useState(() =>
    resolvePreviewSlug(beaches, initialSlug)
  );
  const [widgetType, setWidgetType] = useState<WidgetType>("conditions");

  const embedCode = buildEmbedCode(selectedSlug, widgetType);

  return (
    <main>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <header className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
        <ScrollReveal>
          <div className="relative">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-8 right-6 hidden w-36 rotate-6 opacity-85 sm:block"
            />
            <p className="label-black mb-5">For coastal businesses</p>
            <h1 className="zine-h1 font-heading font-black uppercase leading-[0.9] tracking-normal text-[#11100D]">
              {COPY.heroTitle}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
              {COPY.heroSubtitle}
            </p>
            <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
              <span>Live NOAA + buoy data</span>
              <span aria-hidden>/</span>
              <span>One line of HTML</span>
              <span aria-hidden>/</span>
              <span>$0, no API keys</span>
            </div>
            <div className="mt-8">
              <a
                href="#generator"
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
              >
                Build Your Widget
              </a>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div className="hidden lg:block">
            <MockBrowserWindow slug={selectedSlug} widgetType={widgetType} />
          </div>
        </ScrollReveal>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Value props                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-14" aria-labelledby="value-props-heading">
        <ScrollReveal>
          <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <div>
              <p className="typewriter mb-2">Why embed Quiver</p>
              <h2
                id="value-props-heading"
                className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
              >
                Live conditions, zero upkeep
              </h2>
            </div>
            <QuiverSticker
              sticker="spotSwellMatch"
              className="hidden w-16 rotate-6 drop-shadow-sm sm:block"
            />
          </div>
        </ScrollReveal>

        <div className="grid gap-5 sm:grid-cols-3">
          {VALUE_PROPS.map((prop, index) => {
            const Icon = prop.icon;
            return (
              <ScrollReveal key={prop.title} delay={index * 60}>
                <div className="torn torn-tb min-h-[12rem] border-2 border-[#11100D] bg-[#FBF6E8]">
                  <span className="circled mb-4 bg-[#F78E42]/35">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="font-heading text-xl font-black uppercase leading-tight text-[#11100D]">
                    {prop.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#11100D]/70">
                    {prop.description}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Embed generator                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section id="generator" className="mt-14 scroll-mt-20">
        <ScrollReveal>
          <div className="mb-6 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <p className="typewriter mb-2">Build it</p>
            <h2 className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              Build Your Embed
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#11100D]/70">
              Pick a beach, choose a widget type, and copy the code.
            </p>
          </div>
        </ScrollReveal>

        <div className="torn border-2 border-[#11100D] bg-[#F0E5CC]">
          {/* Controls */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row">
            {/* Beach selector */}
            <div className="relative flex-1">
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="w-full appearance-none rounded-lg border-2 border-[#11100D] bg-[#FBF6E8] px-4 py-3 pr-10 font-mono text-sm text-[#11100D] focus:outline-none focus:ring-2 focus:ring-[#F78E42]"
                aria-label="Select a beach"
              >
                {beaches.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                    {b.city ? ` — ${b.city}` : ""}
                    {b.state ? `, ${b.state}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#11100D]/50"
                aria-hidden
              />
            </div>

            {/* Widget type toggle */}
            <div className="flex overflow-hidden rounded-lg border-2 border-[#11100D] bg-[#FBF6E8]">
              <button
                type="button"
                onClick={() => setWidgetType("conditions")}
                className={`px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.08em] transition-colors ${
                  widgetType === "conditions"
                    ? "bg-[#F78E42] text-[#11100D]"
                    : "text-[#11100D]/70 hover:bg-[#F0E5CC]"
                }` + " focus-ring"}
              >
                Conditions
              </button>
              <button
                type="button"
                onClick={() => setWidgetType("tides")}
                className={`px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.08em] transition-colors ${
                  widgetType === "tides"
                    ? "bg-[#F78E42] text-[#11100D]"
                    : "text-[#11100D]/70 hover:bg-[#F0E5CC]"
                }` + " focus-ring"}
              >
                Tide Chart
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="mb-8">
            <MockBrowserWindow slug={selectedSlug} widgetType={widgetType} />
          </div>

          {/* Embed code */}
          <div className="rounded-xl border-2 border-[#11100D] bg-[#11100D] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#F4EBD8]/60">
                Embed Code
              </span>
              <CopyButton code={embedCode} />
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm leading-relaxed text-[#F2C94C]">
              {embedCode}
            </pre>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Social proof                                                     */}
      {/* ---------------------------------------------------------------- */}
      <ScrollReveal>
        <section
          className="torn torn-tb rot-neg mt-14 border-2 border-[#11100D] bg-[#F0E5CC]"
          aria-labelledby="social-proof-heading"
        >
          <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p className="typewriter mb-2">Out in the wild</p>
              <h2
                id="social-proof-heading"
                className="font-heading text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl"
              >
                {COPY.socialProofTitle}
              </h2>
            </div>
            <p className="text-base leading-relaxed text-[#11100D]/74 sm:text-lg">
              {COPY.socialProofBody}
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ---------------------------------------------------------------- */}
      {/* Bottom CTA                                                       */}
      {/* ---------------------------------------------------------------- */}
      <ScrollReveal>
        <section
          className="hazards-panel mt-14 text-center"
          aria-labelledby="cta-heading"
        >
          <div className="mx-auto max-w-2xl">
            <h2
              id="cta-heading"
              className="font-heading text-3xl font-black uppercase leading-none text-[#F4EBD8] sm:text-4xl"
            >
              {COPY.ctaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#F4EBD8]/80 sm:text-lg">
              {COPY.ctaBody}
            </p>
            <div className="mt-8">
              <a
                href="#generator"
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-6 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
              >
                Build Your Widget
              </a>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
