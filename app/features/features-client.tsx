"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Database,
  Radio,
  Brain,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FEATURES_EXTENDED_CONTENT } from "@/lib/constants/content";
import { FEATURE_CARDS } from "@/lib/constants/features";
import { motion } from "framer-motion";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";

const PIPELINE_ICONS = [Database, Radio, Brain, User] as const;

export default function FeaturesPageClient() {
  const {
    hero,
    pipeline,
    personalization,
    intelligence,
    discovery,
    sessionTracking,
    mobile,
    cta,
  } = FEATURES_EXTENDED_CONTENT;

  return (
    <div className="min-h-screen">
      {/* Section 1: Hero */}
      <section className="py-20 px-4 bg-gradient-to-br from-sandy-beige via-white to-blue-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="text-center mb-12"
          >
            <motion.h1
              className="text-4xl md:text-6xl font-roboto font-bold text-dark-grey mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {hero.title.split("Learn").map((part, i) =>
                i === 0 ? (
                  <span key={i}>{part}</span>
                ) : (
                  <span
                    key={i}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                  >
                    Learn{part}
                  </span>
                )
              )}
            </motion.h1>
            <motion.p
              className="text-xl md:text-2xl text-gray-600 mb-8 font-open-sans max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {hero.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex justify-center mb-12"
            >
              <Button
                size="lg"
                className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                asChild
              >
                <Link href={hero.cta.href}>
                  {hero.cta.text}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl"
          >
            {hero.stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-roboto font-bold text-ocean-blue">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 font-open-sans mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 2: Data Pipeline */}
      <section className="py-20 px-4 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-6xl mx-auto">
          <motion.div {...ANIMATION_VARIANTS.fadeInView} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold mb-4">
              {pipeline.title}
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto font-open-sans">
              {pipeline.subtitle}
            </p>
          </motion.div>

          {/* Pipeline Steps */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
            {pipeline.steps.map((step, index) => {
              const Icon = PIPELINE_ICONS[index];
              return (
                <motion.div
                  key={step.id}
                  {...ANIMATION_VARIANTS.staggerItem(index, 0.6)}
                  className="relative"
                >
                  <Card className="h-full bg-white/5 border-white/10 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-ocean-blue/20 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-ocean-blue" />
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-white/10 text-white/80 text-xs"
                        >
                          Step {index + 1}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-roboto font-bold text-white">
                        {step.title}
                      </h3>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-300 font-open-sans">
                        {step.description}
                      </p>
                    </CardContent>
                  </Card>
                  {/* Connecting arrow (hidden on last item and mobile) */}
                  {index < pipeline.steps.length - 1 && (
                    <div className="hidden md:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <motion.div
                        initial={{ opacity: 0, x: -5 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.2 + 0.5 }}
                      >
                        <ArrowRight className="h-5 w-5 text-ocean-blue" />
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Pipeline Stats */}
          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="flex flex-wrap justify-center gap-8"
          >
            {pipeline.stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-roboto font-bold text-ocean-blue">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-400 font-open-sans">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 3: Personalization */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div {...ANIMATION_VARIANTS.fadeInView} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-4">
              {personalization.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto font-open-sans">
              {personalization.subtitle}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Feature List */}
            <div className="space-y-6">
              {personalization.features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  {...ANIMATION_VARIANTS.staggerItem(index, 0.5)}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-[#404C92] flex items-center justify-center mt-0.5">
                    <Check className="h-4 w-4 text-ocean-blue" />
                  </div>
                  <div>
                    <h3 className="font-roboto font-bold text-dark-grey mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600 font-open-sans">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Visual Demo - Match Score Badge */}
            <motion.div
              {...ANIMATION_VARIANTS.fadeInView}
              className="flex justify-center"
            >
              <div className="relative w-72 h-72 rounded-2xl bg-gradient-to-br from-blue-50 to-white dark:from-[#2D357D] dark:to-[#0F1A2E] border border-blue-100 dark:border-[#404C92] shadow-lg flex flex-col items-center justify-center p-6">
                <div className="text-6xl font-roboto font-bold text-ocean-blue mb-2">
                  87
                </div>
                <div className="text-sm font-open-sans text-gray-600 dark:text-gray-400 mb-4">
                  Match Score
                </div>
                <Badge className="bg-ocean-blue/10 text-ocean-blue border-0 text-xs">
                  Great conditions for you
                </Badge>
                <div className="mt-4 text-xs text-gray-500 font-open-sans text-center">
                  Based on your skill level, wave preferences, and schedule
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 4: Live Intelligence */}
      <section className="py-20 px-4 bg-blue-50/50 dark:bg-[#252D6B]">
        <div className="max-w-6xl mx-auto">
          <motion.div {...ANIMATION_VARIANTS.fadeInView} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-4">
              {intelligence.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto font-open-sans">
              {intelligence.subtitle}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {intelligence.cards.map((card, index) => (
              <motion.div
                key={card.id}
                {...ANIMATION_VARIANTS.staggerItem(index, 0.5)}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300 bg-white/90 backdrop-blur-sm border border-gray-100">
                  <CardHeader>
                    <h3 className="text-xl font-roboto font-bold text-dark-grey">
                      {card.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 font-open-sans">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Spot Discovery */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div {...ANIMATION_VARIANTS.fadeInView} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-4">
              {discovery.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto font-open-sans">
              {discovery.subtitle}
            </p>
          </motion.div>

          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="flex flex-wrap justify-center gap-3"
          >
            {discovery.examples.map((example) => (
              <Link key={example.label} href={example.href}>
                <Badge
                  variant="secondary"
                  className="px-4 py-2 text-sm hover:bg-ocean-blue hover:text-white transition-colors duration-200 cursor-pointer"
                >
                  {example.label}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Badge>
              </Link>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 6: Session Tracking */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <motion.div {...ANIMATION_VARIANTS.fadeInView} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-4">
              {sessionTracking.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto font-open-sans">
              {sessionTracking.subtitle}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessionTracking.features.map((feature, index) => (
              <motion.div
                key={feature.title}
                {...ANIMATION_VARIANTS.staggerItem(index, 0.5)}
              >
                <Card className="h-full bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
                  <CardHeader>
                    <h3 className="text-lg font-roboto font-bold text-dark-grey">
                      {feature.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 font-open-sans">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 7: Mobile */}
      <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600 text-white">
        <div className="max-w-6xl mx-auto">
          <motion.div {...ANIMATION_VARIANTS.fadeInView} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold mb-4">
              {mobile.title}
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto font-open-sans">
              {mobile.subtitle}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mobile.features.map((feature, index) => (
              <motion.div
                key={feature.title}
                {...ANIMATION_VARIANTS.staggerItem(index, 0.5)}
              >
                <Card className="h-full bg-white/10 border-white/20 backdrop-blur-sm">
                  <CardHeader>
                    <h3 className="text-lg font-roboto font-bold text-white">
                      {feature.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-white/80 font-open-sans">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 8: CTA */}
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
            className="w-full h-full"
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
            {cta.title}
          </motion.h2>
          <motion.p
            className="text-xl text-white/90 mb-8 font-open-sans"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {cta.subtitle}
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
              className="bg-white text-ocean-blue hover:bg-gray-50 px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              asChild
            >
              <Link href={cta.primaryCta.href}>
                {cta.primaryCta.text}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="border border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-roboto font-semibold rounded-full transition-all duration-300"
              asChild
            >
              <Link href={cta.secondaryCta.href}>{cta.secondaryCta.text}</Link>
            </Button>
          </motion.div>

          <motion.p
            className="text-white/80 text-sm font-open-sans"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {cta.note}
          </motion.p>
        </motion.div>
      </section>

      {/* Feature Cards Overview */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-4">
              Everything at a Glance
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto font-open-sans">
              Six pillars that make Quiver the most data-driven surf platform
              available
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_CARDS.map((feature, index) => (
              <motion.div
                key={feature.title}
                {...ANIMATION_VARIANTS.staggerItem(index, 0.5)}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300 bg-white border border-gray-100">
                  <CardHeader className="text-center pb-4">
                    <div
                      className={`mx-auto mb-4 w-14 h-14 ${feature.iconBgColor} rounded-full flex items-center justify-center`}
                    >
                      <feature.icon
                        className={`h-7 w-7 ${feature.iconColor}`}
                      />
                    </div>
                    <h3 className="text-xl font-roboto font-bold text-dark-grey">
                      {feature.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="font-open-sans text-gray-600 text-center text-sm mb-4">
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Inline Signup CTA after feature cards */}
      <section className="py-12 px-4 bg-gradient-to-br from-white to-blue-50">
        <div className="max-w-4xl mx-auto">
          <InlineSignupCta
            title="Ready to Know Before You Go?"
            description="Get personalized match scores for every beach, based on your skill level and wave preferences."
            primaryButtonText="Get My Forecast"
            source="features-bottom"
          />
        </div>
      </section>

      <StickySignupBar
        source="features-page"
        ctaText="Try It Free"
        supportingText="Personalized surf forecasts — no credit card"
        scrollThreshold={400}
      />
    </div>
  );
}
