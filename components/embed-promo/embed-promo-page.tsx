"use client";

import { useState, useCallback } from "react";
import {
  RefreshCw,
  Code2,
  Zap,
  Check,
  Copy,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "@/components/ui/section-wrapper";
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

interface EmbedPromoPageProps {
  /** Page variant determines headline copy */
  variant: "surf-schools" | "businesses";
  /** Pre-fetched beach options for the dropdown */
  beaches: BeachOption[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALUE_PROPS = [
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
    title: "Free Forever",
    description:
      "No API keys, no rate limits, no subscriptions. Powered by Quiver's open forecast engine.",
  },
];

const VARIANT_COPY = {
  "surf-schools": {
    heroTitle: "Free Surf Conditions Widget for Your Website",
    heroSubtitle:
      "Help students check conditions before lessons. Add real-time wave, wind, and tide data right on your surf school site — no code needed.",
    socialProofTitle: "Trusted by Surf Schools Across California",
    socialProofBody:
      "Surf instructors use Quiver widgets to show parents and students current conditions before class. Reduce no-shows and build trust with transparent, live forecast data.",
    ctaTitle: "Get Your Free Widget",
    ctaBody:
      "Select your beach above, copy the embed code, and paste it into your website. It takes less than 60 seconds.",
  },
  businesses: {
    heroTitle: "Free Beach Conditions Widget",
    heroSubtitle:
      "Keep customers informed with live wave, wind, and tide data on your website. Perfect for hotels, restaurants, and rental shops near the beach.",
    socialProofTitle: "Built for Coastal Businesses",
    socialProofBody:
      "Hotels, beachfront restaurants, and vacation rental sites embed Quiver widgets to help guests plan around the surf. No maintenance required — data stays current automatically.",
    ctaTitle: "Get Your Free Widget",
    ctaBody:
      "Select your beach above, copy the embed code, and paste it into your website. It takes less than 60 seconds.",
  },
};

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
    <div className="w-full max-w-xl mx-auto">
      {/* Browser chrome */}
      <div className="bg-slate-700 rounded-t-xl px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 ml-3">
          <div className="bg-slate-600 rounded-md px-3 py-1 text-xs text-slate-300 truncate">
            your-website.com
          </div>
        </div>
      </div>
      {/* Browser body with iframe */}
      <div className="bg-white rounded-b-xl p-4 shadow-2xl">
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
    <Button
      onClick={handleCopy}
      variant="outline"
      size="sm"
      className="shrink-0 gap-2"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copy Code
        </>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EmbedPromoPage({ variant, beaches }: EmbedPromoPageProps) {
  const copy = VARIANT_COPY[variant];
  const [selectedSlug, setSelectedSlug] = useState(
    beaches[0]?.slug ?? "blacks"
  );
  const [widgetType, setWidgetType] = useState<WidgetType>("conditions");

  const embedCode = buildEmbedCode(selectedSlug, widgetType);

  return (
    <>
      {/* ----------------------------------------------------------------- */}
      {/* Hero Section — dark background with mock browser                  */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div className="text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-6">
                {copy.heroTitle}
              </h1>
              <p className="text-lg font-sans text-slate-300 max-w-lg mx-auto lg:mx-0 mb-8">
                {copy.heroSubtitle}
              </p>
              <Button
                size="lg"
                className="bg-ocean-blue hover:bg-ocean-blue/90 text-white shadow-lg rounded-full px-8"
                asChild
              >
                <a href="#generator">Build Your Widget</a>
              </Button>
            </div>

            {/* Right: mock browser */}
            <div className="hidden lg:block">
              <MockBrowserWindow
                slug={selectedSlug}
                widgetType={widgetType}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Value Props — 3-column grid with circular icons                   */}
      {/* ----------------------------------------------------------------- */}
      <SectionWrapper
        className="py-20 px-4 bg-white"
        centerContent
        maxWidth="6xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {VALUE_PROPS.map((prop) => (
            <div key={prop.title} className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-sky-100 rounded-full mb-5">
                <prop.icon className="h-7 w-7 text-ocean-blue" />
              </div>
              <h3 className="text-xl font-heading font-bold text-gray-900 mb-2">
                {prop.title}
              </h3>
              <p className="font-sans text-gray-600 leading-relaxed max-w-xs">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* ----------------------------------------------------------------- */}
      {/* Embed Generator — dropdown, widget type, live preview, code block */}
      {/* ----------------------------------------------------------------- */}
      <section
        id="generator"
        className="py-20 px-4 bg-slate-50 scroll-mt-20"
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-gray-900 text-center mb-3">
            Build Your Embed
          </h2>
          <p className="font-sans text-gray-600 text-center mb-10 max-w-xl mx-auto">
            Pick a beach, choose a widget type, and copy the code.
          </p>

          <div className="rounded-2xl border bg-white shadow-lg p-8">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            {/* Beach selector */}
            <div className="relative flex-1">
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-blue focus:border-transparent"
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
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            {/* Widget type toggle */}
            <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setWidgetType("conditions")}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  widgetType === "conditions"
                    ? "bg-ocean-blue text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Conditions
              </button>
              <button
                type="button"
                onClick={() => setWidgetType("tides")}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  widgetType === "tides"
                    ? "bg-ocean-blue text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Tide Chart
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="mb-8">
            <MockBrowserWindow
              slug={selectedSlug}
              widgetType={widgetType}
            />
          </div>

          {/* Embed code */}
          <div className="bg-slate-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Embed Code
              </span>
              <CopyButton code={embedCode} />
            </div>
            <pre className="overflow-x-auto text-sm text-green-400 font-mono leading-relaxed whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
          </div>
          </div>{/* end card */}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Social Proof                                                      */}
      {/* ----------------------------------------------------------------- */}
      <SectionWrapper
        className="py-20 px-4 bg-white"
        centerContent
        maxWidth="4xl"
      >
        <h2 className="text-3xl font-heading font-bold text-gray-900 mb-4">
          {copy.socialProofTitle}
        </h2>
        <p className="text-lg font-sans text-gray-600 leading-relaxed max-w-2xl mx-auto">
          {copy.socialProofBody}
        </p>
      </SectionWrapper>

      {/* ----------------------------------------------------------------- */}
      {/* Bottom CTA — ocean gradient                                       */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-r from-sky-500 to-blue-600 py-20 px-4 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            {copy.ctaTitle}
          </h2>
          <p className="text-lg font-sans text-high mb-8">{copy.ctaBody}</p>
          <Button
            size="lg"
            className="bg-white text-ocean-blue hover:bg-white/90 rounded-full px-8 font-semibold"
            asChild
          >
            <a href="#generator">Build Your Widget</a>
          </Button>
        </div>
      </section>
    </>
  );
}
