import type React from "react";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { AuthProvider } from "@/context/auth-context";
import { AppHeader } from "@/components/app-header";
import { SEO_CONFIG } from "@/lib/constants/seo";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GoogleAnalytics from "@/components/analytics/google-analytics";
import { Toaster } from "react-hot-toast";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-JZNX7C7XKL";

// Optimize font loading with display swap for better performance
const inter = Inter({
  subsets: ["latin"],
  display: "swap", // Improves LCP by showing fallback font first
  preload: true,
  variable: "--font-inter",
});

// Optimize viewport for mobile performance
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
    <html lang="en" suppressHydrationWarning className={inter.variable}>
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
        <link rel="prefetch" href="/log-session" />
        <link rel="prefetch" href="/plan-session" />
        <link rel="prefetch" href="/map" />

        {/* Preload critical resources for faster LCP */}
        <link
          rel="preload"
          href="/placeholder-logo.png"
          as="image"
          type="image/png"
        />

        <link
          rel="preload"
          href="/logo-word (2).png"
          as="image"
          type="image/png"
        />

        {/* Remove non-existent webpack chunk preload - these are dynamic */}

        {/* Structured Data for SEO */}
        {/* <HomePageStructuredData /> */}

        {/* Critical inline styles for faster render */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Critical loading styles */
              .loading-spinner { 
                width: 20px; 
                height: 20px; 
                border: 2px solid #f3f3f3; 
                border-top: 2px solid #3498db; 
                border-radius: 50%; 
                animation: spin 1s linear infinite; 
              }
              @keyframes spin { 
                0% { transform: rotate(0deg); } 
                100% { transform: rotate(360deg); } 
              }
              
              /* Critical layout styles */
              .min-h-screen { min-height: 100vh; }
              .flex { display: flex; }
              .items-center { align-items: center; }
              .justify-center { justify-content: center; }
              .text-center { text-align: center; }
              .space-y-4 > * + * { margin-top: 1rem; }
              
              /* Prevent layout shift */
              .bg-background { background-color: hsl(var(--background)); }
              .text-muted-foreground { color: hsl(var(--muted-foreground)); }
            `,
          }}
        />
      </head>
      <body className={`${inter.className} font-sans antialiased`}>
        <AuthProvider>
          <AppHeader />
          <main id="main-content" role="main">
            {children}
          </main>
        </AuthProvider>
        {/* Track SPA route changes */}
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        {/* Toast notifications */}
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
            },
          }}
        />
        {/* Vercel Analytics & Speed Insights */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
