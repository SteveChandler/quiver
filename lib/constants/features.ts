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
} from "lucide-react";

export const FEATURE_CARDS = [
  {
    icon: Users,
    title: "Find Your Surf Crew",
    description:
      "Connect with surfers in your area, join group sessions, and build lasting friendships. Never surf alone again with our thriving community.",
    iconBgColor: "bg-ocean-blue/10",
    iconColor: "text-ocean-blue",
    features: [
      {
        icon: Users,
        text: "Find local surf buddies",
        color: "text-ocean-blue",
      },
      {
        icon: Calendar,
        text: "Join group sessions",
        color: "text-ocean-blue",
      },
      {
        icon: MapPin,
        text: "Meet at surf spots",
        color: "text-ocean-blue",
      },
    ],
  },
  {
    icon: TrendingUp,
    title: "Track Epic Sessions",
    description:
      "Log your surf sessions with photos, share your progress, and inspire your community. Build your surf story one session at a time.",
    iconBgColor: "bg-sunset-orange/10",
    iconColor: "text-sunset-orange",
    features: [
      {
        icon: BarChart3,
        text: "Track your progression",
        color: "text-sunset-orange",
      },
      {
        icon: Book,
        text: "Share session stories",
        color: "text-sunset-orange",
      },
      {
        icon: Eye,
        text: "Inspire others",
        color: "text-sunset-orange",
      },
    ],
  },
  {
    icon: MapPin,
    title: "Discover Epic Spots",
    description:
      "Explore new surf breaks with community reviews, local insights, and real-time conditions. Find your next favorite surf spot.",
    iconBgColor: "bg-green-500/10",
    iconColor: "text-green-600",
    features: [
      {
        icon: Waves,
        text: "Live surf conditions",
        color: "text-green-600",
      },
      {
        icon: AlertTriangle,
        text: "Local knowledge & tips",
        color: "text-green-600",
      },
      {
        icon: Clock,
        text: "Best times to surf",
        color: "text-green-600",
      },
    ],
  },
];

// Hero video configuration
export const HERO_VIDEOS = [
  "/2802271-hd_1920_1080_30fps.mp4",
  "/2867912-uhd_3840_2160_25fps.mp4",
  "/2873484-hd_1920_1080_25fps.mp4",
];

// Content strings to reduce hardcoding
export const CONTENT = {
  hero: {
    title: ["Where Surf", "Meets Community"],
    subtitle: "Plan. Track. Connect.",
    cta: "Join 1,000+ Surfers",
    benefits: [
      "📊 Track & share your sessions",
      "🌊 Get accurate surf forecasts",
      "📍 Discover epic surf spots",
    ],
  },
  sections: {
    social: {
      title: "Join the surf community that's changing everything",
      subtitle:
        "See what 1,000+ surfers are sharing - epic sessions, hidden spots, and the stoke that keeps us coming back",
    },
    forecast: {
      title: "Get the most accurate surf forecasts",
      subtitle:
        "Know exactly when to paddle out with forecasts trusted by your local surf community",
      link: "See detailed forecasts →",
    },
    features: {
      title: "Everything you need to surf with friends",
      subtitle:
        "From finding surf buddies to sharing epic sessions - your complete surf community platform",
    },
    cta: {
      title: "Ready to join the surf revolution?",
      subtitle:
        "Join 1,000+ surfers who've found their crew, tracked epic sessions, and discovered amazing spots. Free to join, priceless connections.",
    },
  },
} as const;
