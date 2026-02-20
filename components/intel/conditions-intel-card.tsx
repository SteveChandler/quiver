"use client";

import type { IntelPostWithUser } from "@/types/database";
import type { MorningIntelSurfConditionsPayloadV2 } from "@/types/morning-intel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, Waves, Wind } from "lucide-react";
import { formatTideHeight } from "@/lib/formatters/surf-data";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getMorningIntelPayloadV2(
  value: unknown
): MorningIntelSurfConditionsPayloadV2 | null {
  if (!isRecord(value)) return null;
  if (value.kind !== "morning_intel_v2") return null;

  // Object shape checks
  if (!isRecord(value.recommendation)) return null;
  if (!isRecord(value.surf)) return null;
  if (!isRecord(value.wind)) return null;
  if (!isRecord(value.tide)) return null;
  if (typeof value.bestWindow !== "string") return null;

  // Validate required primitives to prevent runtime crashes
  const { tide, surf, wind, recommendation } = value;
  if (typeof tide.height !== "number" || typeof tide.direction !== "string") return null;
  if (typeof surf.min !== "number" || typeof surf.max !== "number") return null;
  if (typeof wind.speed !== "number" || typeof wind.cardinal !== "string") return null;
  if (typeof recommendation.decision !== "string" || typeof recommendation.label !== "string") return null;
  if (!Array.isArray(recommendation.reasons)) return null;

  return value as unknown as MorningIntelSurfConditionsPayloadV2;
}

function getDecisionBadgeClass(decision: MorningIntelSurfConditionsPayloadV2["recommendation"]["decision"]) {
  switch (decision) {
    case "worth_it":
      return "bg-emerald-600 text-white border-emerald-600";
    case "maybe":
      return "bg-yellow-500 text-white border-yellow-500";
    case "skip":
      return "bg-rose-600 text-white border-rose-600";
    default:
      return "bg-muted text-foreground";
  }
}

function formatScore(conditions?: MorningIntelSurfConditionsPayloadV2["conditions"]) {
  if (!conditions || typeof conditions.score !== "number") return null;
  return `${conditions.score}/10`;
}

export function ConditionsIntelCard({
  post,
  variant = "feed",
}: {
  post: IntelPostWithUser;
  variant?: "feed" | "modal";
}) {
  const payload = getMorningIntelPayloadV2(post.surf_conditions);
  if (!payload) return null;

  const score = formatScore(payload.conditions);

  return (
    <div className={cn("space-y-3", variant === "feed" ? "pt-1" : "pt-0")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn("text-xs font-medium", getDecisionBadgeClass(payload.recommendation.decision))}
        >
          {payload.recommendation.label}
        </Badge>
        {score && (
          <Badge variant="secondary" className="text-xs">
            {score} score
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {payload.confidence} confidence
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Best window</p>
            <p className="text-sm font-medium truncate">{payload.bestWindow}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
          <Waves className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Surf</p>
            <p className="text-sm font-medium truncate">
              {payload.surf.min}–{payload.surf.max} ft
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
          <Wind className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Wind</p>
            <p className="text-sm font-medium truncate">
              {payload.wind.speed} mph {payload.wind.cardinal}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
          <div className="h-4 w-4 rounded-full border bg-background" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Tide</p>
            <p className="text-sm font-medium truncate">
              {formatTideHeight(payload.tide.height)} {payload.tide.direction}
            </p>
          </div>
        </div>
      </div>

      {variant === "modal" && (
        <div className="space-y-2">
          {payload.recommendation.reasons.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {payload.recommendation.decision === "worth_it"
                ? "Why: "
                : payload.recommendation.decision === "skip"
                ? "Main issue: "
                : "Watch: "}
              <span className="text-foreground">
                {payload.recommendation.reasons.join(", ")}
              </span>
            </p>
          )}

          {(payload.beach?.skillLevel || (payload.beach?.hazards && payload.beach.hazards.length > 0)) && (
            <div className="rounded-md border bg-muted/20 p-3">
              {payload.beach?.skillLevel && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Suggested skill:</span>{" "}
                  <span className="font-medium">{payload.beach.skillLevel}</span>
                </p>
              )}
              {payload.beach?.hazards && payload.beach.hazards.length > 0 && (
                <p className="text-sm mt-1">
                  <span className="text-muted-foreground">Hazards:</span>{" "}
                  <span className="font-medium">{payload.beach.hazards.join(", ")}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


