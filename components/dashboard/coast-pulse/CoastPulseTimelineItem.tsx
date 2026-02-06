"use client";

import Image from "next/image";
import { MoreVertical, Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmojiRatingDisplay } from "@/components/intel/emoji-picker";
import { formatTimeAgo } from "@/lib/utils/time-formatters";
import { formatDistanceDisplay } from "@/lib/utils/distance-utils";
import { SOURCE_CONFIG, getTrendIcon } from "./constants";
import type { CoastPulseItem } from "./types";

interface CoastPulseTimelineItemProps {
  item: CoastPulseItem;
  onReport: (postId: string) => void;
  onPhotoClick: (url: string, caption?: string) => void;
}

/**
 * CoastPulseTimelineItem - Renders a single timeline item
 */
export function CoastPulseTimelineItem({ item, onReport, onPhotoClick }: CoastPulseTimelineItemProps) {
  const config = SOURCE_CONFIG[item.source.type] || SOURCE_CONFIG.local;

  return (
    <div
      key={item.id}
      className="relative pb-4 last:pb-0 animate-in fade-in duration-300"
    >
      {/* Timeline dot */}
      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#f97316] border-[3px] border-[#1e1e1e]" />

      {/* Content */}
      <div className="space-y-1">
        {/* Source line with badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.colorClass}`}
          >
            {config.icon}
            {config.label}
          </span>
          <p className="text-xs font-medium text-gray-400 truncate max-w-[180px]">
            {item.source.name}
          </p>

          {/* Overflow menu for intel items */}
          {item.source.type === "intel" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-auto p-1 hover:bg-white/10 rounded">
                  <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#2a2a2a] border-white/10">
                <DropdownMenuItem
                  onClick={() => onReport(item.id.replace("intel-", ""))}
                  className="text-red-400 focus:text-red-400"
                >
                  <Flag className="w-3.5 h-3.5 mr-2" />
                  Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Message with emoji rating if present */}
        <div className="flex items-start gap-2">
          {item.emoji_rating && (
            <EmojiRatingDisplay rating={item.emoji_rating} />
          )}
          <p className="text-sm text-white leading-snug flex-1 line-clamp-3">
            {item.message}
          </p>
          {item.trend && getTrendIcon(item.trend)}
        </div>

        {/* Photo thumbnail */}
        {item.photoUrl && (
          <button
            onClick={() => onPhotoClick(item.photoUrl!, item.message)}
            className="mt-2 relative w-12 h-12"
          >
            <Image
              src={item.photoUrl}
              alt="Intel photo"
              fill
              className="rounded-lg object-cover hover:opacity-80 transition-opacity"
              sizes="48px"
            />
          </button>
        )}

        {/* Timestamp and distance */}
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{formatTimeAgo(new Date(item.timestamp))}</span>
          {item.location && formatDistanceDisplay(item.location.distanceKm * 0.621371, "compact") && (
            <>
              <span>·</span>
              <span>{formatDistanceDisplay(item.location.distanceKm * 0.621371, "compact")}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
