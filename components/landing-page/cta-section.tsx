"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";

export function CTASection() {
  const searchParams = useSearchParams();

  return (
    <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600 relative overflow-hidden">
      {/* Background Pattern (static; keep landing CSS-only) */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="w-full h-full bg-gradient-to-br from-white to-transparent"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 80%, white 2px, transparent 2px), radial-gradient(circle at 80% 20%, white 2px, transparent 2px)",
            backgroundSize: "100px 100px",
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in-up">
        <h2 className="text-3xl md:text-4xl font-roboto font-bold text-white mb-6 animate-fade-in-up">
          Ready to Join the Surf Community?
        </h2>

        <p
          className="text-xl text-white/90 mb-8 font-open-sans animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          Find your crew, track epic sessions, and discover amazing spots. Free to join — priceless connections.
        </p>

        <div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 animate-fade-in-up"
          style={{ animationDelay: "400ms" }}
        >
          <Button
            size="lg"
            className="bg-white text-ocean-blue hover:bg-gray-50 px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 motion-optimized like-button-spring ripple-effect"
            asChild
          >
            <Link href={preserveQueryParams("/auth/sign-up", searchParams)}>
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
            <Link href={preserveQueryParams("/about", searchParams)}>
              Learn More
            </Link>
          </Button>
        </div>

        <p
          className="text-white/80 text-sm font-open-sans animate-fade-in-up"
          style={{ animationDelay: "600ms" }}
        >
          🏄‍♀️ No credit card required • Join 1,200+ surfers already connecting
        </p>
      </div>
    </section>
  );
}
