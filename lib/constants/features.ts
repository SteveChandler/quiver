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
} from "lucide-react";

export const FEATURE_CARDS = [
  {
    icon: Calendar,
    title: "Session Planner Pro",
    description:
      "AI-powered session planning with automatic ideal time selection, smart gear recommendations, and exclusive invite-only group sessions.",
    iconBgColor: "bg-ocean-blue/10",
    iconColor: "text-ocean-blue",
    features: [
      {
        icon: Clock,
        text: "Auto-select ideal times",
        color: "text-ocean-blue",
      },
      {
        icon: Settings,
        text: "Smart gear suggestions",
        color: "text-ocean-blue",
      },
      {
        icon: Users,
        text: "Invite-only group sessions",
        color: "text-ocean-blue",
      },
    ],
  },
  {
    icon: BarChart3,
    title: "Surf Journal+",
    description:
      "Advanced wave analytics and performance tracking with private logs and personalized surf habit insights.",
    iconBgColor: "bg-sunset-orange/10",
    iconColor: "text-sunset-orange",
    features: [
      {
        icon: TrendingUp,
        text: "Wave analytics",
        color: "text-sunset-orange",
      },
      {
        icon: BarChart3,
        text: "Performance tracking",
        color: "text-sunset-orange",
      },
      {
        icon: Book,
        text: "Private logs & insights",
        color: "text-sunset-orange",
      },
    ],
  },
  {
    icon: MapPin,
    title: "Local Intel Club",
    description:
      "Exclusive access to user-submitted local knowledge including parking secrets, hazard warnings, and crowd vibes.",
    iconBgColor: "bg-green-500/10",
    iconColor: "text-green-600",
    features: [
      {
        icon: Car,
        text: "Parking secrets",
        color: "text-green-600",
      },
      {
        icon: AlertTriangle,
        text: "Hazard warnings",
        color: "text-green-600",
      },
      {
        icon: Eye,
        text: "Crowd vibes intel",
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
    title: ["Surf Together,", "Anytime,", "Anywhere"],
    subtitle:
      "Connect with your surf community, plan sessions, and share the stoke",
    cta: "Join the Wave",
  },
  sections: {
    social: {
      title: "See what your friends are catching",
      subtitle:
        "Get inspired by your community's latest sessions and discover new spots",
    },
    forecast: {
      title: "Perfect timing, every time",
      subtitle: "Get accurate forecasts to plan your next session",
      link: "View full 10-day forecast",
    },
    features: {
      title: "Everything you need to surf better",
      subtitle: "From planning to sharing, Quiver has you covered",
    },
    cta: {
      title: "Ready to catch your next wave?",
      subtitle:
        "Join thousands of surfers already using Quiver to connect, plan, and share their passion for the ocean.",
    },
  },
} as const;
