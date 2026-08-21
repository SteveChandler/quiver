import {
  BarChart3,
  MapPin,
  Users,
  Settings,
  TrendingUp,
  Book,
  Eye,
  AlertTriangle,
  Waves,
  Wind,
  Baby,
  Heart,
  Mountain,
  Brain,
  Star,
  Smartphone,
  Apple,
  Zap,
} from "lucide-react";

export const FEATURE_CARDS = [
  {
    icon: Brain,
    title: "Your Surf Call",
    description:
      "We read the buoys, the wind, the tide, and the swell — then tell you what it means at your beach, explained clearly.",
    iconBgColor: "bg-ocean-blue/10",
    iconColor: "text-ocean-blue",
    features: [
      {
        icon: Waves,
        text: "Refreshed every 3 hours",
        color: "text-ocean-blue",
      },
      {
        icon: TrendingUp,
        text: "Trained on 90 days of buoy ground truth",
        color: "text-ocean-blue",
      },
      {
        icon: BarChart3,
        text: "NOAA + Open-Meteo + your local buoys",
        color: "text-ocean-blue",
      },
    ],
  },
  {
    icon: Star,
    title: "Tuned to You",
    description:
      "Log what happened and Quiver scores new windows against your own sessions — your spots, your wave range, and when you like to go.",
    iconBgColor: "bg-sunset-orange/10",
    iconColor: "text-sunset-orange",
    features: [
      {
        icon: Star,
        text: "Match score built from your sessions",
        color: "text-sunset-orange",
      },
      {
        icon: Users,
        text: "Community-powered live intel",
        color: "text-sunset-orange",
      },
      {
        icon: Brain,
        text: "Every log is a day to compare against",
        color: "text-sunset-orange",
      },
    ],
  },
  {
    icon: Waves,
    title: "What's Happening Now",
    description:
      "Live conditions from buoys and surfers at your local breaks.",
    iconBgColor: "bg-green-500/10",
    iconColor: "text-green-600",
    features: [
      {
        icon: Waves,
        text: "Live buoy observations",
        color: "text-green-600",
      },
      {
        icon: Users,
        text: "Community activity feed",
        color: "text-green-600",
      },
      {
        icon: Eye,
        text: "Coast pulse updates",
        color: "text-green-600",
      },
    ],
  },
  {
    icon: MapPin,
    title: "Spot Discovery",
    description:
      "350+ intent-based guide pages help you find the right break for any style, skill level, or time of day.",
    iconBgColor: "bg-[#4A70D9]/10",
    iconColor: "text-[#4A70D9]",
    features: [
      {
        icon: MapPin,
        text: "Regional hub guides",
        color: "text-[#4A70D9]",
      },
      {
        icon: Book,
        text: "Intent-based pages",
        color: "text-[#4A70D9]",
      },
      {
        icon: AlertTriangle,
        text: "Local insider tips",
        color: "text-[#4A70D9]",
      },
    ],
  },
  {
    icon: BarChart3,
    title: "Session Tracking",
    description:
      "Auto-prefilled conditions, equipment logs, notes, and accuracy feedback turn each session into useful signal for the next call.",
    iconBgColor: "bg-blue-500/10",
    iconColor: "text-blue-600",
    features: [
      {
        icon: BarChart3,
        text: "Auto-prefilled conditions",
        color: "text-blue-600",
      },
      {
        icon: Settings,
        text: "Equipment tracking",
        color: "text-blue-600",
      },
      {
        icon: TrendingUp,
        text: "Progression analytics",
        color: "text-blue-600",
      },
    ],
  },
  {
    icon: Smartphone,
    title: "Get the App",
    description:
      "Quiver is live on iPhone, and the Android beta is open through Google Play closed testing.",
    iconBgColor: "bg-[#F78E42]/10",
    iconColor: "text-[#F78E42]",
    features: [
      {
        icon: Apple,
        text: "iPhone App Store",
        color: "text-[#F78E42]",
      },
      {
        icon: Smartphone,
        text: "Android beta access",
        color: "text-[#F78E42]",
      },
      {
        icon: Zap,
        text: "Native Android access",
        color: "text-[#F78E42]",
      },
    ],
  },
  {
    icon: Users,
    title: "Community",
    description:
      "Share sessions, post photos, and connect with surfers at your local breaks. Real reports put eyes on the breaks the cams miss.",
    iconBgColor: "bg-[#F78E42]/10",
    iconColor: "text-[#F78E42]",
    features: [
      {
        icon: Users,
        text: "Local surf crews",
        color: "text-[#F78E42]",
      },
      {
        icon: Heart,
        text: "Session sharing",
        color: "text-[#F78E42]",
      },
      {
        icon: Eye,
        text: "Live crowd reports",
        color: "text-[#F78E42]",
      },
    ],
  },
];

// Surf Activities for discovery navigation
export const SURF_ACTIVITIES = [
  {
    icon: Users,
    title: "Longboarding",
    description:
      "Find mellow breaks perfect for longboard cruising. Classic style meets modern community.",
    imageSrc: "/longboard.webp",
    imageAlt: "Surfer at sunset near a surf shack",
    link: "/map?type=longboard",
    iconBgColor: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    icon: Waves,
    title: "Reef Breaks",
    description:
      "Powerful reef breaks with consistent swells. Perfect barrels await.",
    imageSrc: "/reef.jpg",
    imageAlt: "Breaking wave at a reef break",
    link: "/map?type=reef",
    iconBgColor: "bg-[#4A70D9]/10",
    iconColor: "text-[#4A70D9]",
  },
  {
    icon: Mountain,
    title: "Point Breaks",
    description:
      "Explore legendary point breaks with long, peeling waves. Chase those endless rides.",
    imageSrc: "/point-break.webp",
    imageAlt: "Long peeling wave at a point break",
    link: "/map?type=point",
    iconBgColor: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    icon: Baby,
    title: "Beginner-Friendly",
    description:
      "Safe, gentle breaks perfect for learning. Start your surf journey with confidence.",
    imageSrc: "/beginnerWhiteWater.jpg",
    imageAlt: "Young surfers at the beach",
    link: "/map?level=beginner",
    iconBgColor: "bg-yellow-100",
    iconColor: "text-yellow-600",
  },
  {
    icon: Waves,
    title: "Boogie Boarding",
    description:
      "Fun, approachable waves perfect for bodyboarders. Great for shorebreak barrels.",
    imageSrc: "/boogieboarding.jpg",
    imageAlt: "Surfers in the lineup",
    link: "/map?type=bodyboard",
    iconBgColor: "bg-pink-100",
    iconColor: "text-pink-600",
  },
  {
    icon: Wind,
    title: "Offshore Winds",
    description:
      "Find spots with optimal offshore conditions. Perfect grooming for that epic session.",
    imageSrc: "/offShore.jpeg",
    imageAlt: "Sunset over the ocean",
    link: "/map",
    iconBgColor: "bg-teal-100",
    iconColor: "text-teal-600",
  },
];

// Content strings to reduce hardcoding
export const CONTENT = {
  hero: {
    title: "One surf call, then a smarter next one.",
    subtitle:
      "Quiver lays out the window beach by beach — swell, wind, tide, and the red flags — so you make the call. Log what happened and you've got your own days to compare the next one against.",
    cta: "Get my surf call",
    secondaryCta: "Find your spots",
    benefits: [
      "🏄‍♀️ Connect with local surfers",
      "📊 Track epic sessions",
      "🌊 Community forecasts",
    ],
  },
  sections: {
    surfHighlights: {
      title: "Local surf favorites near you",
      subtitle: "",
    },
    upgradeSession: {
      title: "Upgrade your next Session",
      subtitle:
        "Whether you want to explore new breaks or plan your next session, Quiver helps you make the most of every minute in the water.",
      primaryCta: "Check your forecast",
    },
    social: {
      title: "Join the surf community that's growing every day",
      subtitle:
        "See what surfers are sharing — epic sessions, hidden spots, and the stoke that keeps us coming back",
    },
    forecast: {
      title: "One call before you paddle out",
      subtitle:
        "Quiver folds swell, wind, tide, and beach context into a clear recommendation so you know where and when to go.",
      primaryCta: "Explore forecasts on the map",
      secondaryCta: "Create a free account",
    },
    activities: {
      title: "Browse by activity",
      subtitle: "",
    },
    features: {
      title: "Everything you need to surf with friends",
      subtitle:
        "From finding surf buddies to sharing epic sessions, your complete surf community platform",
    },
    cta: {
      title: "Check it, surf it, log it",
      subtitle:
        "Check the forecast, surf the session, log what happened — and build the record you'll compare every next call against.",
    },
  },
} as const;
