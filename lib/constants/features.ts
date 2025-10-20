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

// Surf Activities for discovery navigation
export const SURF_ACTIVITIES = [
  {
    icon: Users,
    title: "Longboarding",
    description:
      "Find mellow breaks perfect for longboard cruising. Classic style meets modern community.",
    link: "/discover?type=longboard",
    iconBgColor: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    icon: Waves,
    title: "Reef Breaks",
    description:
      "Discover powerful reef breaks with consistent swells. For experienced surfers seeking the perfect barrel.",
    link: "/discover?type=reef",
    iconBgColor: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    icon: Mountain,
    title: "Point Breaks",
    description:
      "Explore legendary point breaks with long, peeling waves. Chase those endless rides.",
    link: "/discover?type=point",
    iconBgColor: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    icon: Baby,
    title: "Beginner-Friendly",
    description:
      "Safe, gentle breaks perfect for learning. Start your surf journey with confidence.",
    link: "/discover?level=beginner",
    iconBgColor: "bg-yellow-100",
    iconColor: "text-yellow-600",
  },
  {
    icon: Heart,
    title: "Women-Led Spots",
    description:
      "Empowering surf spots with welcoming communities. Built by women, for everyone.",
    link: "/discover?community=women",
    iconBgColor: "bg-pink-100",
    iconColor: "text-pink-600",
  },
  {
    icon: Wind,
    title: "Offshore Winds",
    description:
      "Find spots with optimal offshore conditions. Perfect grooming for that epic session.",
    link: "/discover?conditions=offshore",
    iconBgColor: "bg-teal-100",
    iconColor: "text-teal-600",
  },
];

// Content strings to reduce hardcoding
export const CONTENT = {
  hero: {
    title: "Find your next surf break",
    subtitle:
      "Discover epic surf spots, check live conditions, and connect with the local surf community.",
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
      title: "Discover epic surf spots near you",
      subtitle:
        "Explore breaks with real-time conditions, community reviews, and local insights. Find your next perfect wave.",
    },
    social: {
      title: "Join the surf community that's growing every day",
      subtitle:
        "See what surfers are sharing — epic sessions, hidden spots, and the stoke that keeps us coming back",
    },
    forecast: {
      title: "Get the most accurate surf forecasts",
      subtitle:
        "Know exactly when to paddle out with forecasts trusted by your local surf community",
      link: "See detailed forecasts →",
    },
    activities: {
      title: "Find spots that match your style",
      subtitle:
        "From mellow longboard waves to gnarly reef breaks — discover surf spots tailored to your vibe.",
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
