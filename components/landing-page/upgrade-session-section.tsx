"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Users, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTENT } from "@/lib/constants/features";

export function UpgradeSessionSection() {
  return (
    <section className="py-16 md:py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div
          className="relative overflow-hidden rounded-3xl border border-gray-200 shadow-sm bg-[#d7e1ea]"
          data-testid="upgrade-session-section"
        >
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left: copy + CTA */}
            <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-[#d7e1ea]">
              {/* Animated icon (AllTrails-style) */}
              <div className="relative h-9 w-9 mb-6">
                <Waves
                  aria-hidden="true"
                  className="absolute inset-0 h-9 w-9 text-ocean-blue iconCycle iconCycle0"
                />
                <MapPin
                  aria-hidden="true"
                  className="absolute inset-0 h-9 w-9 text-ocean-blue iconCycle iconCycle1"
                />
                <Users
                  aria-hidden="true"
                  className="absolute inset-0 h-9 w-9 text-ocean-blue iconCycle iconCycle2"
                />
                <span className="sr-only">Wave, map, and community icons</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-heading font-bold text-dark-grey leading-tight">
                {CONTENT.sections.upgradeSession.title}
              </h2>

              <p className="mt-4 text-base sm:text-lg font-sans text-gray-600 leading-relaxed max-w-xl">
                {CONTENT.sections.upgradeSession.subtitle}
              </p>

              <div className="mt-8">
                <Button
                  size="lg"
                  className="rounded-full px-8 bg-ocean-blue hover:bg-ocean-blue/90 text-white shadow-sm"
                  asChild
                >
                  <Link href="/auth/sign-up">
                    {CONTENT.sections.upgradeSession.primaryCta}
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right: image */}
            <div className="relative min-h-[260px] sm:min-h-[320px] md:min-h-[420px]">
              <Image
                src="/landing-upgrade-session.jpg"
                alt="Surfers sitting on boards in calm water"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={false}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#d7e1ea]/35 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes iconCycle {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          8% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          25% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          33% {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
        }

        :global(.iconCycle) {
          animation: iconCycle 6.6s infinite;
          will-change: transform, opacity;
        }
        :global(.iconCycle0) {
          animation-delay: 0s;
        }
        :global(.iconCycle1) {
          animation-delay: 2.2s;
        }
        :global(.iconCycle2) {
          animation-delay: 4.4s;
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.iconCycle) {
            animation: none !important;
            opacity: 0 !important;
            transform: none !important;
          }
          :global(.iconCycle0) {
            opacity: 1 !important;
          }
        }
      `}</style>
    </section>
  );
}
