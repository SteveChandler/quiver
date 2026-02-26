"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { cn } from "@/lib/utils";

interface PersonalizedForecastTeaserProps {
  beachId: string;
  beachName: string;
  className?: string;
}

const FEATURE_BULLETS = [
  "Wave difficulty rating for your skill",
  "Best time windows for YOU",
  "Crowd preferences applied",
] as const;

export function PersonalizedForecastTeaser({
  beachId: _beachId,
  beachName,
  className,
}: PersonalizedForecastTeaserProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [showAuth, setShowAuth] = useState(false);

  if (user) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5 space-y-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
          <Target className="h-4 w-4 text-ocean-blue" />
        </div>
        <h3 className="text-base font-semibold text-dark-grey">
          Personalized Forecast
        </h3>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground">
        See conditions matched to YOUR level
      </p>

      {/* Feature bullets */}
      <ul className="space-y-2">
        {FEATURE_BULLETS.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-ocean-blue" />
            </span>
            {bullet}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowAuth(true)}
          className="w-full rounded-xl bg-ocean-blue px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-ocean-blue/90 active:scale-[0.98]"
        >
          Get Your Forecast
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Free &bull; No credit card
        </p>
      </div>

      <UnifiedAuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        mode="signup"
        source="personalized-forecast-teaser"
        contextMessage={{
          title: "Get Your Personalized Forecast",
          description: `See conditions at ${beachName} matched to your skill level and preferences`,
        }}
        returnTo={pathname}
      />
    </div>
  );
}
