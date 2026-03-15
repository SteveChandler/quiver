export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const SEO_CONFIG = {
  // Primary metadata
  title:
    "Quiver — Surf Reports & Forecasts for 185+ Beaches",
  description:
    "ML-powered surf forecasts updated every 3 hours with live buoy data. Crowd levels, tide charts & personalized surf windows for California, Hawaii, Puerto Rico & Oregon.",
  keywords: [
    // P0: Queries to own
    "best time to surf today",
    "least crowded surf spots",
    "AI surf forecast",
    "personalized surf forecast",

    // P1: High-volume daily queries
    "surf report",
    "surf forecast",
    "surf conditions today",
    "wave height today",
    "surf forecast app",
    "tide chart",
    "surf cam",

    // P1: Discovery & beginner queries
    "best beginner surf spots",
    "where to surf today",
    "learn to surf",
    "beginner surf spots California",
    "surf spots near me",

    // P2: Feature & product keywords
    "surf tracker app",
    "surf session tracker",
    "track my surf sessions",
    "surf journal app",
    "wave height tracker",
    "best time to surf",

    // P2: Community & social
    "surf community",
    "find surf buddies",
    "surf buddy finder",
    "connect with surfers app",

    // P2: Regional
    "surfing California",
    "best surfing in California",
    "California surf forecast",
    "Hawaii surf report",
    "Puerto Rico surf forecast",
    "Caribbean surfing",
    "Rincon surf report",
    "surfing Puerto Rico",
  ],

  // Open Graph enhanced
  openGraph: {
    title: "Quiver — Surf Reports, Forecasts & Live Conditions",
    description:
      "ML-powered surf forecasts, crowd intelligence, and personalized surf windows for 185+ beaches. Updated every 3 hours with live buoy data.",
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
    title: "Quiver — Surf Reports, Forecasts & Live Conditions",
    description:
      "ML-powered surf forecasts, live crowd data & personalized surf windows for 185+ beaches.",
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
        "ML-powered surf forecast platform with live conditions, crowd intelligence, and session tracking for 279+ beaches across California, Hawaii, Oregon, Washington, Florida, Puerto Rico, and more",
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
        "Surf forecasts updated every 3 hours with real buoy data. Personalized match scores, crowd levels, tide charts & optimal surf windows for 185+ beaches.",
    },

    website: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Quiver — Surf Reports & Forecasts",
      alternateName: "Quiver",
      description:
        "Surf forecast platform with ML-powered conditions, crowd intelligence, and personalized session tracking for 185+ beaches",
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
