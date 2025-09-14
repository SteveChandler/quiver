import type React from "react";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Roboto, Open_Sans, Montserrat } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { AuthProvider } from "@/context/auth-context";
import { AppHeader } from "@/components/app-header";
import { SEO_CONFIG } from "@/lib/constants/seo";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GoogleAnalytics from "@/components/analytics/google-analytics";
import PWAAndPushListeners from "@/components/analytics/pwa-and-push-listeners";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-JZNX7C7XKL";

// Optimize font loading with display swap for better performance
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
});

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-roboto",
});

const openSans = Open_Sans({
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
  preload: false, // Not critical for LCP
  variable: "--font-open-sans",
});

const montserrat = Montserrat({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false, // Not critical for LCP
  variable: "--font-montserrat",
});

// Optimize viewport for mobile performance
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: {
    default: "Quiver | Surf Community & Session Tracker",
    template: "%s | Quiver",
  },
  description:
    "Join the ultimate surf community. Find surf buddies, track sessions, get forecasts, and discover the best surf spots.",
  generator: "Next.js",

  // Performance optimizations
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),

  // Favicon configuration - uses default favicon.ico

  // Open Graph optimizations for social sharing
  openGraph: {
    title: SEO_CONFIG.openGraph.title,
    description: SEO_CONFIG.openGraph.description,
    url: "/",
    siteName: SEO_CONFIG.openGraph.siteName,
    locale: SEO_CONFIG.openGraph.locale,
    type: SEO_CONFIG.openGraph.type as any,
    images: SEO_CONFIG.openGraph.images,
  },

  // Twitter optimizations
  twitter: {
    card: SEO_CONFIG.twitter.card as any,
    title: SEO_CONFIG.twitter.title,
    description: SEO_CONFIG.twitter.description,
    site: SEO_CONFIG.twitter.site,
    creator: SEO_CONFIG.twitter.creator,
    images: SEO_CONFIG.openGraph.images?.[0]?.url,
  },

  // Performance hints
  other: {
    ...SEO_CONFIG.additionalMeta,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${roboto.variable} ${openSans.variable} ${montserrat.variable}`}
    >
      <head>
        {/* Google Analytics (GA4) */}
        <Script
          id="ga-script"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script
          id="ga-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);} 
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: false });
              ${process.env.NODE_ENV !== "production" ? "try{gtag('set','debug_mode',true);}catch(_){}" : ""}
            `,
          }}
        />
        {/* Resource hints for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="//api.mapbox.com" />
        <link rel="dns-prefetch" href="//maps.googleapis.com" />
        <link rel="dns-prefetch" href="//maps.geoapify.com" />

        {/* Prefetch critical routes for faster navigation */}
        <link rel="prefetch" href="/sessions/new" />
        {/* Consolidated into /sessions/new above */}
        <link rel="prefetch" href="/map" />

        {/* Preload critical resources for faster LCP */}
        <link
          rel="preload"
          href="/logoQuiver.png"
          as="image"
          type="image/png"
        />

        {/* Remove non-existent webpack chunk preload - these are dynamic */}

        {/* Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "Quiver",
                alternateName: "Quiver Surf App",
                description:
                  "Ultimate surf community platform - Community-driven surf session tracking and social platform",
                url:
                  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
                logo: `${
                  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
                }/logoQuiver.png`,
                foundingDate: "2024",
                applicationCategory: "Sports & Recreation",
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "Quiver - Surf Community App",
                url:
                  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${
                    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
                  }/search?q={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              },
            ]),
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
                border-top: 2px solid #3498db; 
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
      <body className={`${inter.className} font-sans antialiased`}>
        <AuthProvider>
          {/* Track page views on client-side route changes */}
          <Suspense fallback={null}>
            <GoogleAnalytics />
          </Suspense>
          <Suspense fallback={null}>
            <PWAAndPushListeners />
          </Suspense>
          <Suspense fallback={null}>
            <AppHeader />
          </Suspense>
          <main id="main-content" role="main">
            {children}
          </main>
          {/* Toast systems: shadcn UI (in-app) and Sonner (global) */}
          <Toaster />
          <SonnerToaster />
          {/* Expose a lightweight confetti availability flag for E2E */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(){
                  try {
                    window.confetti = window.confetti || function(){};
                  } catch(_) {}
                })();
              `,
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
