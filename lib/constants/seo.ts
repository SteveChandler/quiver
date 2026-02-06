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
    "surf community",
    "surfing san diego",
    "surf lessons near me",

    // Niche & feature-focused keywords
    "surf forecast app",
    "surf tracker app",
    "surf reports",
    "find surf spots",
    "surf meetups",
    "local surf events",
    "surf social app",
    "surf group chat",
    "surf journal app",
    "surf log book",
    "wave height tracker",
    "surf diary",
    "surfing progress tracker",
    "tide tracker app",

    // Long-tail & local keywords
    "best surf app for beginners",
    "San Diego surf community",
    "connect with surfers app",
    "surf lessons San Diego",
    "surf events near me",
    "Pacific Beach surf scene",
    "Encinitas surf report",
    "track my surf sessions",
    "surf session journal",
    "log surf conditions",

    // App-specific functionality
    "surf session tracker",
    "find surf buddies",
    "surf social network",
    "surf buddy finder",
    "track surf sessions",
    "surf spot reviews",
    "plan surf sessions",
    "surf conditions tracker",
    "surf community platform",
    "surfing social media",
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
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Quiver - The People's Report - Surf Community App",
      },
    ],
  },

  // Twitter Card enhanced
  twitter: {
    card: "summary_large_image",
    title: "Quiver - Ultimate Surf Community Platform",
    description:
      "Find surf buddies, track sessions, get forecasts. Join the surf community that's revolutionizing how surfers connect.",
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
      foundingDate: "2024",
      applicationCategory: "Sports & Recreation",
      operatingSystem: "Web, iOS, Android",
    },

    website: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Quiver - Surf Community App",
      alternateName: "Quiver",
      description:
        "Ultimate surf community platform - Find surf buddies, track sessions, and join the thriving surf community",
      url: SITE_URL,
      publisher: {
        "@type": "Organization",
        name: "Quiver",
        logo: `${SITE_URL}/logo.png`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/discover?search={search_term_string}`,
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
