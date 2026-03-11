import type React from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk, Space_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { SEO_CONFIG } from "@/lib/constants/seo";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/shared/site-footer";
import { HideOnRoutes } from "@/components/hide-on-routes";
import { buildRootStructuredDataGraph } from "@/lib/seo/root-structured-data";

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
  description:
    SEO_CONFIG.description,
  generator: "Next.js",

  // Performance optimizations
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
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
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get pathname from middleware header for conditional SSR
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isLandingPage = pathname === "/";
  const isEmbedRoute = pathname.startsWith("/embed");

  // Show the shared site footer on public content pages; hide on landing
  // (has its own footer), auth pages, authenticated app pages, and embeds.
  const hideFooterPrefixes = ["/auth", "/admin", "/profile", "/inbox", "/sessions", "/prefs", "/embed", "/welcome", "/map"];
  const showSiteFooter =
    !isLandingPage && !hideFooterPrefixes.some((p) => pathname.startsWith(p));

  // Embed routes get a minimal shell — no providers, nav, footer, or heavy assets
  if (isEmbedRoute) {
    return (
      <html lang="en" className={dmSans.variable}>
        <head>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                :root {
                  --background: 0 0% 100%;
                  --foreground: 222.2 84% 4.9%;
                  --card: 0 0% 100%;
                  --card-foreground: 222.2 84% 4.9%;
                  --primary: 201 100% 36%;
                  --border: 214.3 31.8% 91.4%;
                  --muted: 210 40% 96.1%;
                  --muted-foreground: 215.4 16.3% 46.9%;
                }
                body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
              `,
            }}
          />
        </head>
        <body className={`${dmSans.className} font-sans antialiased`}>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
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
        {/* Note: logoQuiver.png is only used on landing page, so preload is handled there */}
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
      <body className={`${dmSans.className} font-sans antialiased theme-retro-dark noise-texture-subtle`}>
        <Providers>{children}</Providers>

        {/* Footer: server guard prevents rendering on excluded routes;
            HideOnRoutes client gate handles stale layout after SPA navigation */}
        <HideOnRoutes exact={["/"]} prefixes={hideFooterPrefixes}>
          {showSiteFooter && <SiteFooter />}
        </HideOnRoutes>
      </body>
    </html>
  );
}
