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
import { QuiverSticker, ZineSurface } from "@/components/zine";
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

interface SurfSchoolsZinePageProps {
  /** Pre-fetched beach options for the dropdown */
  beaches: BeachOption[];
  /** Validated beach slug selected by the server page */
  initialSlug?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface ValueProp {
  icon: LucideIcon;
  title: string;
  description: string;
}

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
  heroTitle: "Free Surf Conditions Widget for Your Website",
  heroSubtitle:
    "Help students check conditions before lessons. Add real-time wave, wind, and tide data right on your surf school site — no code needed.",
  socialProofTitle: "Trusted by Surf Schools Across California",
  socialProofBody:
    "Surf instructors use Quiver widgets to show parents and students current conditions before class. Reduce no-shows and build trust with transparent, live forecast data.",
  ctaTitle: "Get Your Free Widget",
  ctaBody:
    "Select your beach above, copy the embed code, and paste it into your website. It takes less than 60 seconds.",
};

// ---------------------------------------------------------------------------
// Helpers (preserved byte-for-byte from embed-promo-page)
// ---------------------------------------------------------------------------

function buildEmbedCode(slug: string, widgetType: WidgetType): string {
  const src = `${SITE_URL}/embed/${widgetType}/${slug}`;
  const height = widgetType === "tides" ? "400" : "320";
  return `<iframe src="${src}" width="100%" height="${height}" style="border:none;border-radius:12px;" loading="lazy" title="Quiver ${widgetType === "tides" ? "Tide Chart" : "Surf Conditions"}"></iframe>`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WidgetPreview({
  slug,
  widgetType,
}: {
  slug: string;
  widgetType: WidgetType;
}) {
  const src = `${SITE_URL}/embed/${widgetType}/${slug}`;
  const height = widgetType === "tides" ? 400 : 320;

  return (
    <div className="polaroid rot-2 mx-auto w-full max-w-xl">
      <div className="photo bg-[#FBF6E8] p-3" style={{ aspectRatio: "auto" }}>
        <iframe
          src={src}
          width="100%"
          height={height}
          style={{ border: "none", borderRadius: 12 }}
          loading="lazy"
          title="Widget preview"
        />
      </div>
      <p className="cap">live on your site</p>
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
      className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.25)] transition-transform hover:-translate-y-0.5 focus-ring"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" aria-hidden />
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

export function SurfSchoolsZinePage({
  beaches,
  initialSlug,
}: SurfSchoolsZinePageProps) {
  const [selectedSlug, setSelectedSlug] = useState(() =>
    resolvePreviewSlug(beaches, initialSlug)
  );
  const [widgetType, setWidgetType] = useState<WidgetType>("conditions");

  const embedCode = buildEmbedCode(selectedSlug, widgetType);

  return (
    <ZineSurface
      sectionLabel="Surf schools"
      editionLabel="Free embed widget"
      data-testid="for-surf-schools-zine-surface"
    >
      <main>
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <header className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-end">
          <ScrollReveal>
            <div className="relative">
              <QuiverSticker
                sticker="orangeTape"
                className="absolute -top-8 right-8 hidden w-36 rotate-6 opacity-85 sm:block"
              />
              <p className="label-black mb-5">For surf schools</p>
              <h1 className="zine-h1 font-heading font-black uppercase leading-[0.9] tracking-normal text-[#11100D]">
                {COPY.heroTitle}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
                {COPY.heroSubtitle}
              </p>
              <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
                <span>Live NOAA data</span>
                <span aria-hidden>/</span>
                <span>One line of HTML</span>
                <span aria-hidden>/</span>
                <span>$0, no API keys</span>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
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
            <WidgetPreview slug={selectedSlug} widgetType={widgetType} />
          </ScrollReveal>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Value props                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-14" aria-labelledby="value-props-heading">
          <ScrollReveal>
            <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
              <div>
                <p className="typewriter mb-2">Why embed</p>
                <h2
                  id="value-props-heading"
                  className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
                >
                  Set it once, it stays current
                </h2>
              </div>
              <QuiverSticker
                sticker="spotWindRead"
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

          <ScrollReveal>
            <div className="torn border-2 border-[#11100D] bg-[#F0E5CC] p-6 sm:p-8">
              {/* Controls */}
              <div className="mb-8 flex flex-col gap-4 sm:flex-row">
                {/* Beach selector */}
                <div className="relative flex-1">
                  <select
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                    className="w-full appearance-none rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-4 py-3 pr-10 text-sm text-[#11100D] focus:outline-none focus:ring-2 focus:ring-[#F78E42]"
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
                    className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#11100D]/55"
                    aria-hidden
                  />
                </div>

                {/* Widget type toggle */}
                <div className="flex overflow-hidden rounded-full border-2 border-[#11100D] bg-[#FBF6E8]">
                  <button
                    type="button"
                    onClick={() => setWidgetType("conditions")}
                    className={`px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                      widgetType === "conditions"
                        ? "bg-[#F78E42] text-[#11100D]"
                        : "text-[#11100D]/70 hover:bg-[#11100D]/5"
                    }` + " focus-ring"}
                  >
                    Conditions
                  </button>
                  <button
                    type="button"
                    onClick={() => setWidgetType("tides")}
                    className={`px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                      widgetType === "tides"
                        ? "bg-[#F78E42] text-[#11100D]"
                        : "text-[#11100D]/70 hover:bg-[#11100D]/5"
                    }` + " focus-ring"}
                  >
                    Tide Chart
                  </button>
                </div>
              </div>

              {/* Live preview */}
              <div className="mb-8">
                <WidgetPreview slug={selectedSlug} widgetType={widgetType} />
              </div>

              {/* Embed code */}
              <div className="rounded-xl border-2 border-[#11100D] bg-[#11100D] p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#F4EBD8]/70">
                    Embed Code
                  </span>
                  <CopyButton code={embedCode} />
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm leading-relaxed text-[#F78E42]">
                  {embedCode}
                </pre>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Social proof                                                     */}
        {/* ---------------------------------------------------------------- */}
        <ScrollReveal>
          <section
            className="torn torn-tb rot-neg mt-14 border-2 border-[#11100D] bg-[#F0E5CC]"
            aria-labelledby="social-proof-heading"
          >
            <div className="grid gap-5 md:grid-cols-[0.92fr_1.08fr] md:items-center">
              <div className="relative">
                <QuiverSticker
                  sticker="creamTape"
                  className="absolute -top-9 left-6 z-10 hidden w-28 -rotate-6 opacity-90 sm:block"
                />
                <p className="typewriter mb-2">Proof</p>
                <h2
                  id="social-proof-heading"
                  className="font-heading text-2xl font-black uppercase leading-none text-[#11100D] sm:text-3xl"
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
          <section className="hazards-panel mt-14" aria-labelledby="bottom-cta-heading">
            <div className="grid gap-6 text-center lg:text-left">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#F2C94C]">
                  Less than 60 seconds
                </p>
                <h2
                  id="bottom-cta-heading"
                  className="mt-3 font-heading text-3xl font-black uppercase leading-none text-[#F4EBD8] sm:text-4xl"
                >
                  {COPY.ctaTitle}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#F4EBD8]/80 sm:text-lg lg:mx-0">
                  {COPY.ctaBody}
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
                  <a
                    href="#generator"
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-[#F4EBD8] bg-[#F78E42] px-6 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(244,235,216,0.35)] transition-transform hover:-translate-y-0.5"
                  >
                    Build Your Widget
                  </a>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </main>
    </ZineSurface>
  );
}
