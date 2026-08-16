"use client";

import { useState } from "react";
import { Clipboard, Check, Share2, CheckCircle2, ClipboardList, Lock } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";

interface SmartChecklistProps {
  /** Best window time range */
  bestWindow: { start: string; end: string; reason: string } | null;
  /** Intent slug for board recommendation */
  intentSlug: string;
  /** City name for display */
  cityName: string;
  /** Top beach name (for crowd note) */
  topBeachName?: string;
  /** Wind forecast summary */
  windForecast?: string;
  /** Whether this is tomorrow's plan */
  isTomorrow?: boolean;
}

function getBoardRecommendation(intentSlug: string): string {
  switch (intentSlug) {
    case "longboard":
      return "Bring: longboard, wax, sunscreen";
    case "least-crowded":
      return "Bring: your go-to board, patience for the walk";
    case "dawn-patrol":
      return "Bring: shortboard, wax, headlamp for the walk down";
    case "sunset":
      return "Bring: your favorite board, camera for the light";
    case "water-temp":
      return "Bring: right wetsuit thickness, booties if needed";
    default:
      return "Bring: board, wax, leash";
  }
}

function buildChecklistItems(props: SmartChecklistProps): string[] {
  const { bestWindow, intentSlug, topBeachName, windForecast } = props;
  const items: string[] = [];

  if (bestWindow) {
    items.push(`Best window: ${bestWindow.start}\u2013${bestWindow.end}`);
  }

  items.push(getBoardRecommendation(intentSlug));

  if (windForecast) {
    items.push(`Wind: ${windForecast}`);
  }

  if (topBeachName && intentSlug === "least-crowded") {
    items.push(`Parking: expect crowd at ${topBeachName} \u2014 have a backup`);
  }

  items.push("Log it after: 15 seconds builds your forecast");

  return items;
}

function buildChecklistText(
  items: string[],
  cityName: string,
  isTomorrow: boolean
): string {
  const dayLabel = isTomorrow ? "Tomorrow's" : "Today's";
  const header = `\uD83C\uDFC4 ${dayLabel} Surf Plan \u2014 ${cityName}`;
  const body = items.map((item) => `\u2022 ${item}`).join("\n");
  return `${header}\n\n${body}\n\nvia Quiver \u2014 quiversurf.app`;
}

/**
 * SmartChecklist - Dynamic, shareable surf plan checklist for intent pages.
 *
 * Generates a personalized checklist based on intent type, best window,
 * wind forecast, and crowd conditions. Supports copy-to-clipboard and
 * native share for viral distribution.
 */
export function SmartChecklist({
  bestWindow,
  intentSlug,
  cityName,
  topBeachName,
  windForecast,
  isTomorrow = false,
}: SmartChecklistProps) {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const isUnlocked = !!user;

  const items = buildChecklistItems({
    bestWindow,
    intentSlug,
    cityName,
    topBeachName,
    windForecast,
    isTomorrow,
  });

  const checklistText = buildChecklistText(items, cityName, isTomorrow);

  // Build share-safe text: replace real times with placeholder for logged-out users
  const shareText = isUnlocked
    ? checklistText
    : checklistText.replace(/Best window: .+/, "Best window: Sign in to unlock");

  async function handleCopy() {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success("Plan copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    const dayLabel = isTomorrow ? "Tomorrow's" : "Today's";
    const title = `${dayLabel} Surf Plan`;
    let method: "native_share" | "clipboard" = "clipboard";

    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText });
        method = "native_share";
      } catch {
        // User cancelled or share not supported — fall back to clipboard
        await navigator.clipboard.writeText(shareText);
        toast.success("Plan copied!");
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("Plan copied!");
    }

    track("surf_plan_share", { method, intent: intentSlug });
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50/40 to-indigo-50/40 border border-blue-200/50 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="h-5 w-5 text-blue-600 shrink-0" />
        <h3 className="text-base font-semibold text-gray-800">Your surf plan</h3>
      </div>

      {/* Checklist items */}
      <ul className="space-y-2.5 mb-5">
        {items.map((item) => {
          const isBestWindowItem = item.startsWith("Best window:");
          const shouldBlur = isBestWindowItem && !isUnlocked;

          return (
            <li key={item} className="flex items-start gap-2">
              {shouldBlur ? (
                <Lock className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              )}
              {shouldBlur ? (
                <span className="text-sm text-gray-400">
                  Best window:{" "}
                  <span className="blur-[5px] select-none" aria-hidden="true">8:10 AM–10:45 AM</span>
                </span>
              ) : (
                <span className="text-sm text-gray-700">{item}</span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-ocean-blue hover:text-white backdrop-blur-sm focus-ring"
          aria-label="Copy surf plan to clipboard"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Clipboard className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy plan"}
        </button>

        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-ocean-blue hover:text-white backdrop-blur-sm focus-ring"
          aria-label="Share surf plan with your crew"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share to crew
        </button>
      </div>
    </div>
  );
}
