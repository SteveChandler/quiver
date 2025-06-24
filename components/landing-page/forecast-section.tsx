"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import ForecastCard from "@/components/forecast-card";
import { FORECAST_DATA } from "@/lib/constants/mock-data";
import { CONTENT } from "@/lib/constants/features";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";

export function ForecastSection() {
  return (
    <SectionWrapper
      className="py-20 px-4 bg-gradient-to-r from-blue-50 to-cyan-50"
      title={CONTENT.sections.forecast.title}
      subtitle={CONTENT.sections.forecast.subtitle}
      maxWidth="4xl"
      centerContent
    >
      <motion.div
        {...ANIMATION_VARIANTS.fadeUpWithDelay(0.2)}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
      >
        {FORECAST_DATA.map((forecast, index) => (
          <ForecastCard key={index} {...forecast} />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <Link
          href="/auth/sign-up"
          className="text-ocean-blue hover:text-ocean-blue/80 font-montserrat font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
        >
          {CONTENT.sections.forecast.link}
          <ExternalLink className="h-4 w-4" />
        </Link>
      </motion.div>
    </SectionWrapper>
  );
}
