"use client";

import { Activity, Wind, Waves, MapPin, MessageCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { LivePulseItem } from "@/lib/utils/coast-pulse-transforms";

interface LivePulseCarouselProps {
  data: LivePulseItem[];
}

/**
 * LivePulseCarousel - Horizontal scrolling carousel for live coast data
 *
 * Displays a mix of community intel and buoy readings in visually
 * distinct cards with CSS snap scrolling.
 *
 * @example
 * ```tsx
 * const items = transformToLivePulseItems(coastPulseData.items);
 * <LivePulseCarousel data={items} />
 * ```
 */
export function LivePulseCarousel({ data }: LivePulseCarouselProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Activity className="text-ocean-blue" size={16} />
          Live Coast Pulse
        </h3>
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Live</span>
        </span>
      </div>

      {/* Horizontal Feed Container */}
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {data.map((item) => (
          <div
            key={`${item.type}-${item.id}`}
            className={`
              min-w-[280px] snap-center relative overflow-hidden rounded-xl p-4 shadow-lg border border-white/10
              ${item.type === 'intel'
                ? 'bg-gradient-to-br from-indigo-900 to-slate-900'
                : 'bg-gradient-to-br from-slate-800 to-slate-900'}
            `}
          >
            {/* Background Decoration */}
            <div
              className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${
                item.type === 'intel' ? 'bg-indigo-500/20' : 'bg-ocean-blue/20'
              }`}
            />

            {/* Top Row: Location & Time */}
            <div className="relative z-10 mb-3 flex justify-between items-start text-white">
              <div className="flex items-center gap-1.5 text-slate-300">
                {item.type === 'intel' ? <MessageCircle size={12} /> : <MapPin size={12} />}
                <span className="text-xs font-medium uppercase tracking-wider truncate max-w-[140px]">
                  {item.name}
                </span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock size={10} />
                {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
              </span>
            </div>

            {/* Content Body */}
            {item.type === 'intel' ? (
              <IntelCardContent text={item.text} subtitle={item.subtitle} />
            ) : (
              <BuoyCardContent metric={item.metric} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Intel card content - displays community quote with user info
 */
function IntelCardContent({ text, subtitle }: { text?: string; subtitle?: string }) {
  return (
    <div className="relative z-10 text-white h-full flex flex-col justify-between">
      <p className="text-sm font-medium line-clamp-2 leading-snug italic">
        &ldquo;{text}&rdquo;
      </p>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
        <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">
          {subtitle?.charAt(0)?.toUpperCase() ?? "U"}
        </div>
        <p className="text-xs text-indigo-200 truncate">{subtitle ?? "User"}</p>
      </div>
    </div>
  );
}

/**
 * Buoy card content - displays wave and wind metrics
 */
function BuoyCardContent({ metric }: { metric?: LivePulseItem["metric"] }) {
  if (!metric) return null;

  return (
    <div className="relative z-10 grid grid-cols-2 gap-2 text-white">
      {/* Wave Data */}
      <div className="rounded-lg bg-white/5 p-2 backdrop-blur-sm">
        <div className="mb-1 text-ocean-blue">
          <Waves size={16} />
        </div>
        <div className="text-xl font-bold leading-none">
          {metric.height.toFixed(1)}ft
        </div>
        <div className="text-[10px] text-slate-400">
          {metric.period > 0 ? `${metric.period}s` : "—"}
        </div>
      </div>

      {/* Wind Data */}
      <div className="rounded-lg bg-white/5 p-2 backdrop-blur-sm">
        <div className="mb-1 text-sunset-orange">
          <Wind size={16} />
        </div>
        <div className="text-xl font-bold leading-none">
          {metric.wind > 0 ? `${metric.wind}kt` : "—"}
        </div>
        <div className="text-[10px] text-slate-400">
          {metric.windDir > 0 ? `${metric.windDir}°` : "—"}
        </div>
      </div>
    </div>
  );
}

export default LivePulseCarousel;
