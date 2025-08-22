"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Waves,
  Users,
  TrendingUp,
  Star,
  ThumbsUp,
  MessageSquare,
  Share2,
  Clock,
  Calendar,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ENHANCED_ANIMATIONS, QUIVER_MOTION } from "@/lib/constants/animations";
import Link from "next/link";

// Demo data for interactive elements
const DEMO_BEACHES = [
  {
    id: "ob",
    name: "Ocean Beach",
    waves: "4-6 ft",
    wind: "8 mph offshore",
    conditions: "Clean",
    rating: 4.5,
    sessions: 23,
    color: "bg-green-500",
  },
  {
    id: "pb",
    name: "Pacific Beach",
    waves: "2-4 ft",
    wind: "12 mph onshore",
    conditions: "Fair",
    rating: 3.2,
    sessions: 15,
    color: "bg-yellow-500",
  },
  {
    id: "la-jolla",
    name: "La Jolla Shores",
    waves: "1-3 ft",
    wind: "5 mph offshore",
    conditions: "Glassy",
    rating: 4.8,
    sessions: 31,
    color: "bg-blue-500",
  },
];

const DEMO_SESSIONS = [
  {
    id: 1,
    user: "Sarah M.",
    beach: "Ocean Beach",
    rating: 5,
    description: "Epic morning session! Perfect barrels 🤙",
    likes: 12,
    comments: 4,
    time: "2 hours ago",
  },
  {
    id: 2,
    user: "Mike R.",
    beach: "La Jolla",
    rating: 4,
    description: "Glassy conditions, perfect for beginners",
    likes: 8,
    comments: 2,
    time: "4 hours ago",
  },
  {
    id: 3,
    user: "Emma K.",
    beach: "Pacific Beach",
    rating: 3,
    description: "Smaller waves but great for longboarding",
    likes: 15,
    comments: 7,
    time: "6 hours ago",
  },
];

interface InteractiveHeroDemoProps {
  isVisible?: boolean;
}

export function InteractiveHeroDemo({
  isVisible = true,
}: InteractiveHeroDemoProps) {
  const [activeDemo, setActiveDemo] = useState<
    "forecast" | "sessions" | "community"
  >("forecast");
  const [selectedBeach, setSelectedBeach] = useState(0);
  const [likedSessions, setLikedSessions] = useState<Set<number>>(new Set());
  const [animateStats, setAnimateStats] = useState(false);

  // Cycle through beaches automatically
  useEffect(() => {
    if (activeDemo === "forecast") {
      const interval = setInterval(() => {
        setSelectedBeach((prev) => (prev + 1) % DEMO_BEACHES.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeDemo]);

  // Animate stats on mount
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setAnimateStats(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const handleLikeSession = (sessionId: number) => {
    setLikedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  if (!isVisible) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Demo Selection Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center gap-2 mb-6"
      >
        {[
          { id: "forecast", label: "🌊 Live Forecasts", icon: Waves },
          { id: "sessions", label: "📸 Track Sessions", icon: TrendingUp },
          { id: "community", label: "🤙 Find Crew", icon: Users },
        ].map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveDemo(tab.id as typeof activeDemo)}
            variant={activeDemo === tab.id ? "default" : "ghost"}
            className={`motion-optimized like-button-spring ripple-effect px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
              activeDemo === tab.id
                ? "bg-white/90 text-blue-600 shadow-lg"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            data-testid={`demo-tab-${tab.id}`}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </motion.div>

      {/* Interactive Demo Content */}
      <AnimatePresence mode="wait">
        {activeDemo === "forecast" && (
          <motion.div
            key="forecast"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">
                Live Surf Conditions
                <span className="text-sm text-white/60 font-normal ml-2">
                  (Demo)
                </span>
              </h3>
              <span className="text-sm text-white/70">Updated now</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DEMO_BEACHES.map((beach, index) => (
                <motion.div
                  key={beach.id}
                  initial={{ opacity: 0.7 }}
                  animate={{
                    opacity: selectedBeach === index ? 1 : 0.7,
                    scale: selectedBeach === index ? 1.05 : 1,
                  }}
                  className={`session-card-hover cursor-pointer p-4 rounded-lg border border-white/10 transition-all ${
                    selectedBeach === index
                      ? "bg-white/20 border-white/30"
                      : "bg-white/10 hover:bg-white/15"
                  }`}
                  onClick={() => setSelectedBeach(index)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{beach.name}</h4>
                    <div className={`w-3 h-3 rounded-full ${beach.color}`} />
                  </div>
                  <div className="space-y-1 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      <Waves className="h-3 w-3" />
                      <span>{beach.waves}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{beach.wind}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-medium">
                        {beach.conditions}
                      </span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">{beach.rating}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeDemo === "sessions" && (
          <motion.div
            key="sessions"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
          >
            <h3 className="text-xl font-semibold text-white mb-4">
              Recent Sessions
              <span className="text-sm text-white/60 font-normal ml-2">
                (Demo)
              </span>
            </h3>
            <div className="space-y-3">
              {DEMO_SESSIONS.map((session) => (
                <motion.div
                  key={session.id}
                  {...QUIVER_MOTION.social.feedStagger(session.id)}
                  className="session-card-hover bg-white/10 rounded-lg p-4 border border-white/10"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-white">{session.user}</h4>
                      <p className="text-sm text-white/70">
                        {session.beach} • {session.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < session.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-white/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-white/90 text-sm mb-3">
                    {session.description}
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLikeSession(session.id)}
                      className={`motion-optimized like-button-spring ripple-effect flex items-center gap-1 text-sm transition-colors ${
                        likedSessions.has(session.id)
                          ? "text-red-400"
                          : "text-white/70 hover:text-white"
                      }`}
                      data-testid="demo-like-button"
                    >
                      <ThumbsUp
                        className={`h-4 w-4 transition-all ${
                          likedSessions.has(session.id)
                            ? "fill-current scale-110"
                            : ""
                        }`}
                      />
                      <span>
                        {session.likes +
                          (likedSessions.has(session.id) ? 1 : 0)}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 text-sm text-white/70">
                      <MessageSquare className="h-4 w-4" />
                      <span>{session.comments}</span>
                    </div>
                    <button className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors">
                      <Share2 className="h-4 w-4" />
                      <span>Share</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeDemo === "community" && (
          <motion.div
            key="community"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
          >
            <h3 className="text-xl font-semibold text-white mb-4">
              Growing Community
              <span className="text-sm text-white/60 font-normal ml-2">
                (Demo Data)
              </span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: "Active Surfers",
                  value: 1247,
                  icon: Users,
                  demo: true,
                },
                {
                  label: "Sessions Logged",
                  value: 3891,
                  icon: Calendar,
                  demo: true,
                },
                { label: "Beach Reviews", value: 892, icon: Star, demo: true },
                {
                  label: "Photos Shared",
                  value: 2156,
                  icon: Camera,
                  demo: true,
                },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: animateStats ? 1 : 0.8,
                    opacity: animateStats ? 1 : 0,
                  }}
                  transition={{
                    delay: index * 0.1 + 0.5,
                    type: "spring",
                    bounce: 0.3,
                  }}
                  className="text-center"
                >
                  <stat.icon className="h-8 w-8 text-white mx-auto mb-2" />
                  <motion.div
                    initial={{ scale: 1 }}
                    animate={{ scale: animateStats ? [1, 1.1, 1] : 1 }}
                    transition={{ delay: index * 0.1 + 1 }}
                    className="text-2xl font-bold text-white"
                  >
                    {animateStats ? stat.value.toLocaleString() : "0"}
                  </motion.div>
                  <p className="text-sm text-white/70">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-white/90 mb-4">
                "Finally found my surf crew! Best sessions ever 🤙"
              </p>
              <p className="text-sm text-white/70">- Alex, San Diego</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call to Action */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center"
      >
        <p className="text-white/80 text-sm mb-4">
          👆 Click around to explore the app
        </p>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            size="lg"
            className="bg-white/90 text-blue-600 hover:bg-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 motion-optimized like-button-spring"
            asChild
          >
            <Link href="/auth/sign-up">Experience This Live</Link>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
