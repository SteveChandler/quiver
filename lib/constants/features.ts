import {
  Calendar,
  BarChart3,
  MapPin,
  Users,
  Clock,
  Settings,
  TrendingUp,
  Book,
  Eye,
  AlertTriangle,
  Car,
  Waves,
  Anchor,
  Wind,
  Baby,
  Heart,
  Mountain,
  Brain,
  Star,
  Smartphone,
} from "lucide-react";

export const FEATURE_CARDS = [
  {
    icon: Brain,
    title: "ML Forecasts",
    description:
      "XGBoost-corrected wave predictions trained on 30,000+ buoy observations deliver forecasts you can actually trust.",
    iconBgColor: "bg-ocean-blue/10",
    iconColor: "text-ocean-blue",
    features: [
      {
        icon: Waves,
        text: "3hr correction cycle",
        color: "text-ocean-blue",
      },
      {
        icon: TrendingUp,
        text: "90-day training window",
        color: "text-ocean-blue",
      },
      {
        icon: BarChart3,
        text: "Multi-model ensemble",
        color: "text-ocean-blue",
      },
    ],
  },
  {
    icon: Star,
    title: "Personalization",
    description:
      "Match scores from 0-100 rank every beach based on your skill level, preferred conditions, and schedule.",
    iconBgColor: "bg-sunset-orange/10",
    iconColor: "text-sunset-orange",
    features: [
      {
        icon: Star,
        text: "Personalized match scores",
        color: "text-sunset-orange",
      },
      {
        icon: Clock,
        text: "Time-slot filtering",
        color: "text-sunset-orange",
      },
      {
        icon: Users,
        text: "Skill-based recommendations",
        color: "text-sunset-orange",
      },
    ],
  },
  {
    icon: Waves,
    title: "Live Intel",
    description:
      "Real-time buoy feeds, community reports, and coast pulse updates keep you connected to what's happening now.",
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
    iconBgColor: "bg-purple-500/10",
    iconColor: "text-purple-600",
    features: [
      {
        icon: MapPin,
        text: "Regional hub guides",
        color: "text-purple-600",
      },
      {
        icon: Book,
        text: "Intent-based pages",
        color: "text-purple-600",
      },
      {
        icon: AlertTriangle,
        text: "Local insider tips",
        color: "text-purple-600",
      },
    ],
  },
  {
    icon: BarChart3,
    title: "Session Tracking",
    description:
      "Auto-prefilled conditions, equipment logs, and accuracy feedback build a rich history of your surf life.",
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
    title: "Mobile Apps",
    description:
      "Native iOS and Android apps with push alerts, camera integration, and location-aware recommendations.",
    iconBgColor: "bg-teal-500/10",
    iconColor: "text-teal-600",
    features: [
      {
        icon: AlertTriangle,
        text: "Push condition alerts",
        color: "text-teal-600",
      },
      {
        icon: Eye,
        text: "Native camera integration",
        color: "text-teal-600",
      },
      {
        icon: MapPin,
        text: "GPS-based suggestions",
        color: "text-teal-600",
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
    link: "/discover?type=longboard",
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
    link: "/discover?type=reef",
    iconBgColor: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    icon: Mountain,
    title: "Point Breaks",
    description:
      "Explore legendary point breaks with long, peeling waves. Chase those endless rides.",
    imageSrc: "/point-break.webp",
    imageAlt: "Long peeling wave at a point break",
    link: "/discover?type=point",
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
    link: "/discover?level=beginner",
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
    link: "/discover?type=bodyboard",
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
    link: "/discover?conditions=offshore",
    iconBgColor: "bg-teal-100",
    iconColor: "text-teal-600",
  },
];

// Content strings to reduce hardcoding
export const CONTENT = {
  hero: {
    title: "Find your next wave",
    subtitle: "",
    cta: "Join Free Today",
    secondaryCta: "Explore Features",
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
        "Where you want to explore breaks or create your own, create a forecast that helps you make the most of every minute in the water.",
      primaryCta: "Sign up",
    },
    social: {
      title: "Join the surf community that's growing every day",
      subtitle:
        "See what surfers are sharing — epic sessions, hidden spots, and the stoke that keeps us coming back",
    },
    forecast: {
      title: "Pick the right beach for your day",
      subtitle:
        "Know exactly when to paddle out with forecasts trusted by your local surf community",
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
        "From finding surf buddies to sharing epic sessions - your complete surf community platform",
    },
    cta: {
      title: "Ready to join the surf community?",
      subtitle:
        "Find your crew, track epic sessions, and discover amazing spots. Free to join — priceless connections.",
    },
  },
} as const;
