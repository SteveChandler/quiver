import type React from "react";
import type { Metadata, Viewport } from "next";
import {
  DM_Sans,
  Space_Grotesk,
  Space_Mono,
  Caveat,
  Bowlby_One,
  Permanent_Marker,
} from "next/font/google";
import "./globals.css";
import { SEO_CONFIG } from "@/lib/constants/seo";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/shared/site-footer";
import { HideOnRoutes } from "@/components/hide-on-routes";
import { buildRootStructuredDataGraph } from "@/lib/seo/root-structured-data";
import { buildIosSmartAppBannerContent } from "@/lib/constants/app-store";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-heading",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-mono",
});

const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-handwritten",
});

const bowlbyOne = Bowlby_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-zine-display",
});

const permanentMarker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-zine-marker",
});

// Optimize viewport for mobile performance
// Note: maximumScale removed for WCAG 1.4.4 compliance (allow user zoom)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: {
    default: "Quiver | Surf Reports, Forecasts & Conditions",
    template: "%s | Quiver",
  },
  description: SEO_CONFIG.description,
  generator: "Next.js",

  // Performance optimizations
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),

  // Favicon configuration
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },

  // Open Graph optimizations for social sharing
  openGraph: {
    title: SEO_CONFIG.openGraph.title,
    description: SEO_CONFIG.openGraph.description,
    url: "/",
    siteName: SEO_CONFIG.openGraph.siteName,
    locale: SEO_CONFIG.openGraph.locale,
    type: SEO_CONFIG.openGraph.type as any,
    images: SEO_CONFIG.openGraph.images
      ? SEO_CONFIG.openGraph.images.map((img) => ({ ...img }))
      : undefined,
  },

  // Twitter optimizations
  twitter: {
    card: SEO_CONFIG.twitter.card as any,
    title: SEO_CONFIG.twitter.title,
    description: SEO_CONFIG.twitter.description,
    site: SEO_CONFIG.twitter.site,
    creator: SEO_CONFIG.twitter.creator,
    images: ["/twitter-image.png"],
  },

  // Explicit robots so child pages (not-found, auth) can override cleanly
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },

  // Performance hints
  other: {
    ...SEO_CONFIG.additionalMeta,
    "apple-itunes-app": buildIosSmartAppBannerContent(
      process.env.IOS_APP_STORE_PROVIDER_TOKEN,
    ),
  },
};

const hideFooterPrefixes = [
  "/auth",
  "/admin",
  "/profile",
  "/sessions",
  "/prefs",
  "/embed",
  "/welcome",
  "/map",
  "/redeem",
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${spaceGrotesk.variable} ${spaceMono.variable} ${caveat.variable} ${bowlbyOne.variable} ${permanentMarker.variable}`}
    >
      {/* WARNING: No whitespace allowed between tags in <head> to prevent React hydration errors. See: https://react.dev/link/hydration-mismatch */}
      <head>
        {/* Analytics scripts moved to AnalyticsLoader component. This prevents loading GA4 and Ahrefs on the landing page. Performance impact: ~100KB saved, ~20ms faster TTI */}
        {/* Resource hints for performance - ESSENTIAL ONLY */}
        {/* next/font/google handles font preconnect automatically */}
        {/* 
          Localhost safety: if a PWA service worker was previously registered, it can cache
          stale Next.js chunk references and break hydration. This runs before React/JS bundles
          execute to ensure we can always recover.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var host = window.location && window.location.hostname;
                  if (host !== "localhost" && host !== "127.0.0.1") return;
                  if (!("serviceWorker" in navigator)) return;
                  // If a service worker is controlling the page, we *must* clear it even if we did this
                  // earlier in the session (otherwise stale cached chunks can cause hydration failures).
                  var hasController = !!navigator.serviceWorker.controller;
                  if (
                    window.sessionStorage &&
                    sessionStorage.getItem("__quiver_sw_cleared") === "1" &&
                    !hasController
                  ) return;

                  navigator.serviceWorker.getRegistrations().then(function (regs) {
                    // On localhost we never want *any* SW controlling pages.
                    var targets = (regs || []).filter(function (reg) {
                      return reg && reg.active && reg.active.scriptURL;
                    });
                    if (targets.length === 0) return;

                    return Promise.all(targets.map(function (reg) { return reg.unregister(); }))
                      .then(function () {
                        if (!("caches" in window)) return;
                        return caches.keys().then(function (keys) {
                          return Promise.all((keys || []).map(function (k) { return caches.delete(k); }));
                        });
                      })
                      .then(function () {
                        try { sessionStorage.setItem("__quiver_sw_cleared", "1"); } catch (e) { console.warn('Session storage error:', e); }
                        window.location.reload();
                      });
                  });
                } catch (e) { console.warn('Service worker cleanup error:', e); }
              })();
            `,
          }}
        />
        {/*
          Pre-paint auth-cookie detection. Adds `has-auth-cookie` to <body> before
          first paint when a Supabase auth token cookie is present, so CSS can hide
          the SSR popular-beaches strip for signed-in users without waiting for JS
          to hydrate. Mirrors the matcher in lib/utils/supabase-cookie-utils.ts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  if (/(?:^|;\\s*)sb-[^=]+-auth-token\\./.test(document.cookie)) {
                    document.documentElement.classList.add("has-auth-cookie");
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Map-related DNS prefetch removed from root layout. Now loaded in route-specific layouts (map, beaches, forecast). This saves 3-5 connection slots on landing page */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        {/* Apple Touch Icons for iOS PWA support */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon-180x180.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="167x167"
          href="/apple-touch-icon-167x167.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/apple-touch-icon-152x152.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="120x120"
          href="/apple-touch-icon-120x120.png"
        />
        {/* Remove aggressive prefetching on mobile to reduce initial network load */}
        {/* Note: quiver-app-icon.png is only used on landing page, so preload is handled there */}
        {/* Remove non-existent webpack chunk preload - these are dynamic */}
        {/* Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildRootStructuredDataGraph()),
          }}
        />
        {/* Critical inline styles for faster render */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Critical loading spinner keyframes */
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }

              /* Critical loading spinner class (not a Tailwind utility) */
              .loading-spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #F78E42;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              }

              /* Prevent layout shift for app-specific colors */
              .bg-background { background-color: hsl(var(--background)); }
              .text-muted-foreground { color: hsl(var(--muted-foreground)); }
            `,
          }}
        />
      </head>
      <body
        className={`${dmSans.className} font-sans antialiased theme-retro-dark noise-texture-subtle`}
      >
        {/* Skip link — must be the first focusable element in the DOM.
            sr-only hides it visually until focused (keyboard/screen-reader users).
            Targets #main-content which wraps all page content below the nav. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-[#9E5010] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >
          Skip to content
        </a>
        {/* Skip-link target lives on the canonical <main id="main-content">
            inside components/providers.tsx so screen-reader Tab + Enter lands
            below the nav, not above it. Don't re-declare the id here. */}
        <Providers>{children}</Providers>

        {/* HideOnRoutes client gate handles footer visibility via usePathname() */}
        <HideOnRoutes exact={["/"]} prefixes={hideFooterPrefixes}>
          <SiteFooter />
        </HideOnRoutes>
      </body>
    </html>
  );
}
