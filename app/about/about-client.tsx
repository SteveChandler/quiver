"use client";

import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Users,
  Globe,
  Waves,
  Star,
  Camera,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ABOUT_CONTENT } from "@/lib/constants/content";
import { motion } from "framer-motion";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import {
  AnimatedEngagementStat,
  EngagementProgressTracker,
} from "@/components/engagement/micro-interactions";

export default function AboutPageClient() {
  const { hero, mission, story, team, future } = ABOUT_CONTENT;
  const isTest =
    typeof window !== "undefined" && (window as any).__PLAYWRIGHT__ === true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Disable heavy engagement tracker in E2E to prevent dev runtime instability */}
      {!isTest && <EngagementProgressTracker />}

      {/* Enhanced Hero Section with Motion */}
      <section className="py-20 px-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-5">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="w-full h-full"
          >
            <Waves className="w-full h-full text-blue-600" />
          </motion.div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1
              className="text-4xl md:text-6xl font-roboto font-bold text-dark-grey mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              About Quiver
            </motion.h1>
            <motion.h2
              className="text-2xl md:text-3xl font-roboto font-semibold text-gray-700 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              The Story Behind
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {" "}
                Our Community
              </span>
            </motion.h2>
            <motion.p
              className="text-xl md:text-2xl text-gray-600 mb-8 font-open-sans max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Born from a passion for surfing and a belief that the best
              sessions happen with friends, Quiver connects surfers worldwide to
              share the stoke.
            </motion.p>
          </motion.div>

          {/* Community Impact Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-16"
          >
            <AnimatedEngagementStat
              icon={Users}
              value={1247}
              label="Surfers Connected"
              delay={800}
            />
            <AnimatedEngagementStat
              icon={Globe}
              value={23}
              label="Countries"
              delay={1000}
            />
            <AnimatedEngagementStat
              icon={Heart}
              value={8943}
              label="Sessions Shared"
              delay={1200}
            />
            <AnimatedEngagementStat
              icon={Star}
              value={156}
              label="Surf Spots"
              delay={1400}
            />
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-6">
              {mission.title}
            </h2>
            <p className="text-xl text-gray-600 mb-8 font-open-sans">
              {mission.subtitle}
            </p>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto font-open-sans">
              {mission.description}
            </p>
          </div>

          {/* Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {mission.values.map((value, index) => (
              <Card
                key={index}
                className="text-center hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader>
                  <div className="mx-auto mb-4 w-16 h-16 bg-ocean-blue/10 rounded-full flex items-center justify-center">
                    <value.icon className="h-8 w-8 text-ocean-blue" />
                  </div>
                  <h3 className="text-xl font-roboto font-bold text-dark-grey">
                    {value.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 font-open-sans">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-12 text-center">
            {story.title}
          </h2>
          <div className="space-y-8">
            {story.content.map((paragraph, index) => (
              <p
                key={index}
                className="text-lg text-gray-600 font-open-sans leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-6">
            {team.title}
          </h2>
          <p className="text-lg text-gray-600 font-open-sans leading-relaxed">
            {team.description}
          </p>
        </div>
      </section>

      {/* Future Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-6">
              {future.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto font-open-sans mb-12">
              {future.description}
            </p>
          </div>

          {/* Goals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {future.goals.map((goal, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-6 bg-white/80 backdrop-blur-sm rounded-lg"
              >
                <div className="w-8 h-8 bg-ocean-blue/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-ocean-blue font-bold text-sm">
                    {index + 1}
                  </span>
                </div>
                <p className="text-gray-700 font-open-sans">{goal}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section with Motion */}
      <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full"
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, -10, 10, 0],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className="absolute bottom-10 right-10 w-24 h-24 bg-white rounded-full"
          />
        </div>

        <motion.div
          {...ANIMATION_VARIANTS.fadeInView}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <motion.h2
            className="text-3xl md:text-4xl font-roboto font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready to Be Part of Our Story? 🌊
          </motion.h2>
          <motion.p
            className="text-xl text-white/90 mb-8 font-open-sans"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Join 1,200+ surfers who are already building the future of surf
            community on Quiver.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button
              size="lg"
              className="bg-white text-ocean-blue hover:bg-gray-50 px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 motion-optimized like-button-spring ripple-effect"
              asChild
            >
              <Link href="/auth/sign-up">
                Join Our Community
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="border border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-roboto font-semibold rounded-full transition-all duration-300"
              asChild
            >
              <Link href="/features">Explore Features</Link>
            </Button>
          </motion.div>

          <motion.p
            className="text-white/80 text-sm font-open-sans"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            🤙 Free to join • No credit card required • Built by surfers, for
            surfers
          </motion.p>
        </motion.div>
      </section>

    </div>
  );
}
