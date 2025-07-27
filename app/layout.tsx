import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/context/auth-context";
import { AppHeader } from "@/components/app-header";
// import { SEO_CONFIG, PAGE_SEO } from "@/lib/constants/seo";
// import { HomePageStructuredData } from "@/components/seo/structured-data";

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
  title: "Quiver - Surf Sessions Tracker",
  description: "Community-driven surf sessions tracker and predictor",
  generator: "Next.js",

  // Performance optimizations
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),

  // Open Graph optimizations for social sharing
  openGraph: {
    title: "Quiver - Surf Sessions Tracker",
    description: "Community-driven surf sessions tracker and predictor",
    url: "/",
    siteName: "Quiver",
    locale: "en_US",
    type: "website",
  },

  // Twitter optimizations
  twitter: {
    card: "summary_large_image",
    title: "Quiver - Surf Sessions Tracker",
    description: "Community-driven surf sessions tracker and predictor",
  },

  // Performance hints
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
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
      </body>
    </html>
  );
}
