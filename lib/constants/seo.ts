export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const SEO_CONFIG = {
  // Primary metadata
  title:
    "Quiver — Free Surf Reports, Forecasts & Conditions for 279+ Beaches",
  description:
    "Surf reports and forecasts updated every 3 hours with live buoy data. Tide charts, crowd levels & best-time-to-surf windows for California, Hawaii, Florida, East Coast & more. Always free.",
  keywords: [
    "surf report",
    "surf forecast",
    "surf conditions today",
    "free surf report",
    "free surf forecast",
    "surfline alternative",
    "best time to surf",
    "best time to surf today",
    "wave height today",
    "tide chart",
    "surf forecast app",
    "surf cam",
    "surf conditions",
    "surf report today",
    "best surf app",
    "surf spots near me",
    "where to surf today",
    "beginner surf spots",
    "least crowded surf spots",
    "surf tracker app",
    "surf session tracker",
    "surf journal app",
    "California surf report",
    "Hawaii surf report",
    "Florida surf report",
    "surf forecast California",
    "surf forecast Hawaii",
    "Puerto Rico surf report",
    "New Jersey surf report",
    "Oregon surf forecast",
  ],

  // Open Graph enhanced
  openGraph: {
    title: "Quiver — Your Surf Call for 279+ Beaches",
    description:
      "Conditions at your beach, explained clearly. Surf reports, tide charts, crowd data & best-time-to-go windows for 279+ beaches. Free, updated every 3 hours.",
    type: "website",
    locale: "en_US",
    siteName: "Quiver",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Quiver — Surf Reports, Forecasts & Conditions",
      },
    ],
  },

  // Twitter Card enhanced
  twitter: {
    card: "summary_large_image",
    title: "Quiver — Your Surf Call for 279+ Beaches",
    description:
      "Conditions at your beach, explained clearly. Free surf reports, tide charts & crowd data for 279+ beaches.",
    site: "@quiversurf",
    creator: "@quiversurf",
  },

  // Structured Data (JSON-LD)
  structuredData: {
    organization: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Quiver",
      alternateName: "Quiver Surf App",
      description:
        "Free surf report and forecast platform with live conditions, tide charts, crowd data, and session tracking for 279+ beaches across California, Hawaii, Oregon, Washington, Florida, Puerto Rico, and more",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      foundingDate: "2024",
      applicationCategory: "Sports & Recreation",
      operatingSystem: "Web, iOS, Android",
      sameAs: [
        "https://bsky.app/profile/quiversurf.app",
        "https://x.com/quiversurf",
      ],
      founder: {
        "@type": "Person",
        jobTitle: "Founder",
        worksFor: {
          "@type": "Organization",
          name: "Quiver Surf Technologies, Inc.",
        },
      },
      areaServed: [
        {
          "@type": "State",
          name: "California",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "State",
          name: "Oregon",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "State",
          name: "Washington",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "State",
          name: "Hawaii",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "State",
          name: "Florida",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "AdministrativeArea",
          name: "Puerto Rico",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "State",
          name: "New Jersey",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "State",
          name: "New York",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "State",
          name: "North Carolina",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        {
          "@type": "AdministrativeArea",
          name: "Baja California",
          containedInPlace: { "@type": "Country", name: "Mexico" },
        },
      ],
    },

    softwareApplication: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Quiver Surf App",
      applicationCategory: "Sports & Recreation",
      operatingSystem: "Web, iOS, Android",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      url: SITE_URL,
      description:
        "Surf reports and forecasts updated every 3 hours with real buoy data. Crowd levels, tide charts & best-time-to-surf windows for 279+ beaches. Free.",
    },

    website: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Quiver — Surf Reports & Forecasts",
      alternateName: "Quiver",
      description:
        "Free surf report and forecast platform with live conditions, crowd data, tide charts, and session tracking for 279+ beaches",
      url: SITE_URL,
      publisher: {
        "@type": "Organization",
        name: "Quiver",
        logo: `${SITE_URL}/logo.png`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/map?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  },

  // Additional meta tags
  additionalMeta: {
    // robots/googlebot/bingbot directives are set per-page via buildPageMetadata()
    // to allow noindex on auth/404/thin-content pages
    viewport: "width=device-width, initial-scale=1",
    "theme-color": "#0f172a",
    "msapplication-TileColor": "#1e40af",
    
    // Progressive Web App (PWA) support
    "mobile-web-app-capable": "yes",
    
    // iOS PWA support - enables standalone mode and native app-like experience
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Quiver",
    
    "format-detection": "telephone=no",
    "google-site-verification": process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "", // Add verification code via environment variable
  },
} as const;
