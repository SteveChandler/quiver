"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";

export function CTASection() {
  const searchParams = useSearchParams();

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

      <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in-up">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-roboto font-bold text-white mb-6 leading-tight animate-fade-in-up">
          Wherever the swell takes you
        </h2>

        <p
          className="text-lg md:text-xl font-open-sans text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          Track, plan, and share your surf sessions with Quiver. Join the
          community and never miss your next perfect wave.
        </p>

        {/* Social Proof */}
        <div
          className="flex items-center justify-center gap-6 mb-8 text-white/80 animate-scale-in"
          style={{ animationDelay: "300ms" }}
        >
          <div className="text-center">
            <div className="text-2xl font-bold">Active</div>
            <div className="text-sm">Community</div>
          </div>
          <div className="w-px h-8 bg-white/30"></div>
          <div className="text-center">
            <div className="text-2xl font-bold">Built by</div>
            <div className="text-sm">Surfers</div>
          </div>
          <div className="w-px h-8 bg-white/30"></div>
          <div className="text-center">
            <div className="text-2xl font-bold">Free</div>
            <div className="text-sm">To Join</div>
          </div>
        </div>

        <div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up"
          style={{ animationDelay: "400ms" }}
        >
          <Button
            size="lg"
            className="bg-white text-ocean-blue hover:bg-gray-100 px-8 py-4 text-lg font-roboto font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            asChild
          >
            <Link href={preserveQueryParams("/auth/sign-up", searchParams)}>
              Join the Lineup
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <p className="text-white/80 text-sm mt-4">
            Free to join • No credit card required • Built for surfers
          </p>
        </div>
      </div>
    </section>
  );
}
