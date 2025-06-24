"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CONTENT } from "@/lib/constants/features";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";

export function CTASection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600">
      <motion.div
        {...ANIMATION_VARIANTS.fadeInView}
        className="max-w-4xl mx-auto text-center"
      >
        <h2 className="text-4xl md:text-5xl font-roboto font-bold text-white mb-6">
          {CONTENT.sections.cta.title}
        </h2>
        <p className="text-xl font-open-sans text-white/90 mb-8 max-w-2xl mx-auto">
          {CONTENT.sections.cta.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-white text-ocean-blue hover:bg-gray-100 px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            asChild
          >
            <Link href="/auth/sign-up">
              Sign Up Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-ocean-blue px-8 py-4 text-lg font-roboto font-semibold rounded-full transition-all duration-300"
            asChild
          >
            <Link href="/auth/sign-in">Learn More</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
