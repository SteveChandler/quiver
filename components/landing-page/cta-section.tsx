"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CONTENT } from "@/lib/constants/features";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";

export function CTASection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-ocean-blue via-blue-600 to-blue-700 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <svg
            className="w-full h-full"
            width="60"
            height="60"
            viewBox="0 0 60 60"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="wave-pattern"
                x="0"
                y="0"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <g fill="none" fillRule="evenodd">
                  <g fill="#ffffff" fillOpacity="0.1">
                    <path d="M30 30c0-16.569 13.431-30 30-30v60c-16.569 0-30-13.431-30-30z" />
                  </g>
                </g>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wave-pattern)" />
          </svg>
        </div>
      </div>

      <motion.div
        {...ANIMATION_VARIANTS.fadeInView}
        className="max-w-4xl mx-auto text-center relative z-10"
      >
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-5xl lg:text-6xl font-roboto font-bold text-white mb-6 leading-tight"
        >
          {CONTENT.sections.cta.title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl font-open-sans text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed"
        >
          {CONTENT.sections.cta.subtitle}
        </motion.p>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center justify-center gap-6 mb-8 text-white/80"
        >
          <div className="text-center">
            <div className="text-2xl font-bold">1,000+</div>
            <div className="text-sm">Active Surfers</div>
          </div>
          <div className="w-px h-8 bg-white/30"></div>
          <div className="text-center">
            <div className="text-2xl font-bold">4.8★</div>
            <div className="text-sm">User Rating</div>
          </div>
          <div className="w-px h-8 bg-white/30"></div>
          <div className="text-center">
            <div className="text-2xl font-bold">Free</div>
            <div className="text-sm">Forever</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Button
            size="lg"
            className="bg-white text-ocean-blue hover:bg-gray-100 px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            asChild
          >
            <Link href="/auth/sign-up">
              Join 1,000+ Surfers Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <p className="text-white/70 text-sm">
            No credit card required • Join in 30 seconds
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
