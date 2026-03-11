"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";
import { useAuth } from "@/context/auth-context";
import { CONTENT } from "@/lib/constants/features";

export function CTASection() {
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  // Don't render for authenticated users (show during loading to avoid CLS)
  if (!isLoading && user) return null;

  return (
    <section className="py-24 md:py-32 px-4 bg-bg-deep noise-texture-strong relative">
      <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in-up">
        <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-6 animate-fade-in-up text-glow-orange">
          {CONTENT.sections.cta.title}
        </h2>

        <p
          className="text-xl text-[#9AABC6] mb-8 font-sans animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          {CONTENT.sections.cta.subtitle}
        </p>

        <div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 animate-fade-in-up"
          style={{ animationDelay: "400ms" }}
        >
          <Button
            size="lg"
            className="bg-ocean-blue text-white rounded-full px-8 py-3 font-sans font-semibold hover:shadow-lg hover:shadow-ocean-blue/20 transition-all duration-300 hover:bg-ocean-blue/90"
            asChild
          >
            <Link href={preserveQueryParams("/auth/sign-up", searchParams)}>
              {CONTENT.hero.cta}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <Button
            size="lg"
            variant="ghost"
            className="border border-white/30 text-white rounded-full px-6 py-3 font-sans font-semibold hover:bg-white/10"
            asChild
          >
            <Link href={preserveQueryParams("/about", searchParams)}>
              Learn More
            </Link>
          </Button>
        </div>

        <p
          className="text-white/50 text-sm font-sans animate-fade-in-up"
          style={{ animationDelay: "600ms" }}
        >
          Free to join — no credit card required
        </p>
      </div>
    </section>
  );
}
