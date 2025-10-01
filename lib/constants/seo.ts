const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const SEO_CONFIG = {
  // Primary metadata
  title:
    "Quiver - Ultimate Surf Community & Session Tracker | Find Surf Buddies",
  description:
    "Join the ultimate surf community. Find surf buddies, track sessions, get accurate forecasts, and discover the best surf spots. Never surf alone again with Quiver.",
  keywords: [
    // Core surfing keywords
    "surfing",
    "surf app",
    "surf shop",
    "surfboard",
    "surfboards for sale",
    "surf camp",
    "surf lessons near me",
    "surf community",
    "surfing san diego",
    "surf clothing",

    // Niche & feature-focused keywords
    "surf forecast app",
    "surf tracker app",
    "surf reports",
    "find surf spots",
    "surf meetups",
    "local surf events",
    "surf social app",
    "surf group chat",
    "surf coaching app",

    // Long-tail & local keywords
    "best surf app for beginners",
    "San Diego surf community",
    "connect with surfers app",
    "surf lessons San Diego",
    "surf events near me",
    "Pacific Beach surf scene",
    "Encinitas surf report",

    // App-specific functionality
    "surf session tracker",
    "find surf buddies",
    "surf social network",
    "surf buddy finder",
    "track surf sessions",
    "surf spot reviews",
    "plan surf sessions",
    "surf conditions tracker",
  ],

  // Open Graph enhanced
  openGraph: {
    title: "Quiver - Ultimate Surf Community Platform",
    description:
      "Join a growing surf community to find surf buddies, track epic sessions, and discover the best spots. Your surf community awaits.",
    type: "website",
    locale: "en_US",
    siteName: "Quiver - Surf Community App",
    images: [
      {
        url: "/images/buoy.png",
        width: 1200,
        height: 630,
        alt: "Quiver - Surf Community App",
      },
    ],
  },

  // Twitter Card enhanced
  twitter: {
    card: "summary_large_image",
    title: "Quiver - Ultimate Surf Community Platform",
    description:
      "Find surf buddies, track sessions, get forecasts. Join the surf community that's revolutionizing how surfers connect.",
    creator: "@QuiverSurf", // Update when social accounts are created
    site: "@QuiverSurf",
  },

  // Structured Data (JSON-LD)
  structuredData: {
    organization: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Quiver",
      alternateName: "Quiver Surf App",
      description:
        "Ultimate surf community platform - Community-driven surf session tracking and social platform",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      sameAs: [
        "https://instagram.com/quiversurf",
        "https://tiktok.com/@quiversurf",
      ],
      foundingDate: "2024",
      applicationCategory: "Sports & Recreation",
      operatingSystem: "Web, iOS, Android",
    },

    softwareApplication: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Quiver - Surf Community App",
      alternateName: "Quiver Surf Tracker",
      description:
        "Ultimate surf community platform. Find surf buddies, track sessions, get accurate forecasts, and discover the best surf spots worldwide.",
      applicationCategory: "Sports & Recreation",
      applicationSubCategory: "Surfing",
      operatingSystem: ["Web", "iOS", "Android"],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "150",
        bestRating: "5",
        worstRating: "1",
      },
      featureList: [
        "Find surf buddies and build your crew",
        "Track and share epic surf sessions",
        "Get accurate surf forecasts and conditions",
        "Discover new surf spots with community reviews",
        "Plan group surf sessions with friends",
        "Join a thriving surf community",
        "Share session photos and videos",
        "Connect with local surfers worldwide",
      ],
      screenshot: `${SITE_URL}/app-screenshot.jpg`,
      downloadUrl: SITE_URL,
      installUrl: SITE_URL,
    },

    website: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Quiver - Surf Community App",
      alternateName: "Quiver",
      description:
        "Ultimate surf community platform - Find surf buddies, track sessions, and join the thriving surf community",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
      publisher: {
        "@type": "Organization",
        name: "Quiver",
        logo: `${SITE_URL}/logo.png`,
      },
    },
  },

  // Additional meta tags
  additionalMeta: {
    robots:
      "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    googlebot: "index, follow",
    bingbot: "index, follow",
    viewport: "width=device-width, initial-scale=1",
    "theme-color": "#1e40af", // ocean-blue
    "msapplication-TileColor": "#1e40af",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "format-detection": "telephone=no",
    "google-site-verification": "", // Add when Google Search Console is set up
    // Geographic targeting for surf communities
    "geo.region": "US-CA",
    "geo.placename": "San Diego, California",
    "geo.position": "32.7157;-117.1611",
    ICBM: "32.7157, -117.1611",
  },
} as const;
