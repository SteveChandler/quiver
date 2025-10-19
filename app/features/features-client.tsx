"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Users,
  TrendingUp,
  MapPin,
  Star,
  Camera,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FEATURES_EXTENDED_CONTENT } from "@/lib/constants/content";
import { FEATURE_CARDS } from "@/lib/constants/features";
import { motion } from "framer-motion";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import { AnimatedEngagementStat } from "@/components/engagement/micro-interactions";

export default function FeaturesPageClient() {
  const { hero, categories, cta } = FEATURES_EXTENDED_CONTENT;
  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Enhanced Hero Section with Interactive Stats */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="text-center mb-16"
          >
            <motion.h1
              className="text-4xl md:text-6xl font-roboto font-bold text-dark-grey mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {hero.title.split(" with Friends").join("")}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {" "}
                with Friends
              </span>
            </motion.h1>
            <motion.p
              className="text-xl md:text-2xl text-gray-600 mb-8 font-open-sans max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Join the surf community that's growing every day. Connect, share,
              and discover amazing waves with friends.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex justify-center mb-12 relative z-10"
            >
              <Button
                size="lg"
                className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 motion-optimized like-button-spring relative z-10"
                asChild
              >
                <Link href="/auth/sign-up">
                  Start Surfing Together
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Interactive Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl"
          >
            <AnimatedEngagementStat
              icon={Users}
              value={1247}
              label="Active Surfers"
              delay={800}
            />
            <AnimatedEngagementStat
              icon={TrendingUp}
              value={3891}
              label="Sessions Logged"
              delay={1000}
            />
            <AnimatedEngagementStat
              icon={MapPin}
              value={156}
              label="Surf Spots"
              delay={1200}
            />
            <AnimatedEngagementStat
              icon={Camera}
              value={2156}
              label="Photos Shared"
              delay={1400}
            />
          </motion.div>
        </div>
      </section>

      {/* Feature Categories */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {categories.map((category, categoryIndex) => (
            <div key={category.id} className="mb-20">
              {/* Category Header */}
              <div className="text-center mb-12">
                <Badge variant="secondary" className="mb-4 text-sm font-medium">
                  {category.title}
                </Badge>
                <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-4">
                  {category.title}
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto font-open-sans">
                  {category.description}
                </p>
              </div>

              {/* Features Grid with Motion */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {category.features.map((feature, featureIndex) => (
                  <motion.div
                    key={featureIndex}
                    {...ANIMATION_VARIANTS.staggerItem(featureIndex, 0.6)}
                  >
                    <Card className="h-full session-card-hover transition-all duration-300 bg-white/90 backdrop-blur-sm border border-gray-100 motion-optimized">
                      <CardHeader>
                        <h3 className="text-xl font-roboto font-bold text-dark-grey mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-gray-600 font-open-sans">
                          {feature.description}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {feature.benefits.map((benefit, benefitIndex) => (
                            <motion.div
                              key={benefitIndex}
                              className="flex items-center gap-2"
                              initial={{ opacity: 0, x: -10 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ delay: benefitIndex * 0.1 }}
                            >
                              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span className="text-sm text-gray-600 font-open-sans">
                                {benefit}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Original Feature Cards Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-4">
              Core Features at a Glance
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto font-open-sans">
              The essential features that make Quiver your go-to surf community
              platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURE_CARDS.map((feature, index) => (
              <Card
                key={feature.title}
                className="h-full hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader className="text-center pb-4">
                  <div
                    className={`mx-auto mb-4 w-16 h-16 ${feature.iconBgColor} rounded-full flex items-center justify-center`}
                  >
                    <feature.icon className={`h-8 w-8 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-2xl font-roboto font-bold text-dark-grey">
                    {feature.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="font-open-sans text-gray-600 text-center mb-4">
                    {feature.description}
                  </p>
                  <ul className="space-y-2 text-sm font-open-sans text-gray-600">
                    {feature.features.map((featureItem, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-center gap-2"
                      >
                        <featureItem.icon
                          className={`h-4 w-4 ${featureItem.color}`}
                        />
                        {featureItem.text}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section with Motion */}
      <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600 relative overflow-hidden">
        {/* Background Wave Animation */}
        <div className="absolute inset-0 opacity-10">
          <motion.div
            animate={{
              backgroundPositionX: ["0%", "100%"],
              backgroundPositionY: ["0%", "100%"],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              repeatType: "reverse",
            }}
            className="w-full h-full bg-gradient-to-br from-white to-transparent"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 80%, white 2px, transparent 2px), radial-gradient(circle at 80% 20%, white 2px, transparent 2px)",
              backgroundSize: "100px 100px",
            }}
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
            Ready to Join the Surf Community?
          </motion.h2>
          <motion.p
            className="text-xl text-white/90 mb-8 font-open-sans"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Find your crew, track epic sessions, and discover amazing spots.
            Free to join — priceless connections.
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
                Join Free Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="border border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-roboto font-semibold rounded-full transition-all duration-300"
              asChild
            >
              <Link href="/about">Learn More</Link>
            </Button>
          </motion.div>

          <motion.p
            className="text-white/80 text-sm font-open-sans"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            🏄‍♀️ No credit card required • Join 1,200+ surfers already connecting
          </motion.p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-grey text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2">
              <h3 className="text-2xl font-roboto font-bold mb-4">Quiver</h3>
              <p className="font-open-sans text-gray-300 mb-4 max-w-md">
                The ultimate social platform for surfers. Connect with your
                community, plan sessions, and share the stoke.
              </p>
            </div>
            <div>
              <h4 className="font-roboto font-semibold mb-4">Product</h4>
              <ul className="space-y-2 font-open-sans text-gray-300">
                <li>
                  <Link
                    href="/features"
                    className="hover:text-white transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-roboto font-semibold mb-4">Company</h4>
              <ul className="space-y-2 font-open-sans text-gray-300">
                <li>
                  <Link
                    href="/about"
                    className="hover:text-white transition-colors"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-600 pt-8 text-center">
            <p className="font-open-sans text-gray-300 text-sm">
              © 2025 Quiver. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
