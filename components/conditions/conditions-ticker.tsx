"use client";

import { cn } from "@/lib/utils";
import { Compass, Wind, Thermometer, ChevronUp, ChevronDown, Activity } from "lucide-react";
import { AnimatedWaveIcon } from "@/components/ui/animated-wave-icon";
import type { ConditionsData } from "@/types/conditions";
import {
  buildConditionsCards,
  type ConditionsCard,
  type ConditionsIconType,
} from "@/lib/utils/conditions-card-builder";

interface ConditionsTickerProps {
  data: ConditionsData;
  theme?: "light" | "dark";
  loading?: boolean;
  beachName?: string;
  showFrequency?: boolean;
  className?: string;
}

function CardIcon({
  iconType,
  tideRising,
  className,
}: {
  iconType: ConditionsIconType;
  tideRising?: boolean;
  className?: string;
}) {
  const props = { size: 14, className, "aria-hidden": true as const };
  switch (iconType) {
    case "waves":
      return <AnimatedWaveIcon size={14} className={className} />;
    case "swell":
      return <Compass {...props} />;
    case "wind":
      return <Wind {...props} />;
    case "water":
      return <Thermometer {...props} />;
    case "tide":
      return tideRising ? <ChevronUp {...props} /> : <ChevronDown {...props} />;
    case "frequency":
      return <Activity {...props} />;
  }
}

function TickerCard({ card, isDark }: { card: ConditionsCard; isDark: boolean }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0" aria-label={card.ariaLabel}>
      <span className={isDark ? "text-gray-400" : "text-gray-500"}>
        <CardIcon iconType={card.iconType} tideRising={card.tideRising} />
      </span>
      <span
        className={cn(
          "text-[10px] uppercase tracking-wide",
          isDark ? "text-gray-400" : "text-gray-500"
        )}
      >
        {card.label}
      </span>
      <span className="text-sm font-semibold">{card.value}</span>
    </div>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 w-px h-5 self-center",
        isDark ? "bg-gray-700" : "bg-gray-200"
      )}
      aria-hidden="true"
    />
  );
}

function TickerSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="conditions-ticker-skeleton">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "h-6 rounded-full animate-pulse",
            i % 2 === 0 ? "w-20" : "w-16",
            isDark ? "bg-gray-700" : "bg-gray-200"
          )}
        />
      ))}
    </div>
  );
}

export function ConditionsTicker({
  data,
  theme = "light",
  loading = false,
  beachName,
  showFrequency,
  className,
}: ConditionsTickerProps) {
  const isDark = theme === "dark";
  const cards = loading ? [] : buildConditionsCards(data, { showFrequency });

  if (!loading && cards.length === 0) return null;

  const cardsContent = cards.map((card, i) => (
    <span key={card.id} className="flex items-center gap-3 shrink-0">
      {i > 0 && <Divider isDark={isDark} />}
      <TickerCard card={card} isDark={isDark} />
    </span>
  ));

  return (
    <div
      className={cn(
        "overflow-hidden group",
        isDark
          ? "bg-[#2a2a2a] text-gray-300"
          : "bg-white border border-gray-100 text-gray-700",
        className
      )}
      role="region"
      aria-label={
        beachName
          ? `${beachName} current conditions`
          : "Current surf conditions"
      }
    >
      {loading ? (
        <div className="px-4 py-3">
          <TickerSkeleton isDark={isDark} />
        </div>
      ) : (
        <>
          {/* Static track: visible only when prefers-reduced-motion */}
          <div
            className="ticker-static-track items-center gap-3 overflow-x-auto scrollbar-hide px-4 py-3"
            data-testid="ticker-content"
          >
            {cardsContent}
          </div>

          {/* Animated track: auto-scrolling, hidden for reduced motion */}
          <div
            className="ticker-animated-track items-center py-3"
            aria-hidden="true"
          >
            <div className="flex items-center gap-3 w-max animate-ticker-scroll group-hover:[animation-play-state:paused] will-change-transform">
              {[0, 1, 2, 3].map((copy) => (
                <span key={`copy-${copy}`} className="flex items-center gap-3 shrink-0">
                  {copy > 0 && <Divider isDark={isDark} />}
                  {cards.map((card, i) => (
                    <span key={`${copy}-${card.id}`} className="flex items-center gap-3 shrink-0">
                      {i > 0 && <Divider isDark={isDark} />}
                      <TickerCard card={card} isDark={isDark} />
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
