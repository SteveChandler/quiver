"use client";

import React from "react";
import * as dateFns from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Waves,
  Wind,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

const { format } = dateFns;

interface BeachDiscoveryCardProps {
  recommendation: SurfDiscoveryRecommendation;
  rank: number;
  onViewBeach: (beachId: string) => void;
  onPlanSession: (beachId: string) => void;
}

/**
 * MVP Beach Discovery Card
 *
 * Compact card showing ranked surf recommendation with match quality,
 * score, conditions summary, and key reasons.
 */
export function BeachDiscoveryCard({
  recommendation,
  rank,
  onViewBeach,
  onPlanSession,
}: BeachDiscoveryCardProps) {
  const {
    beach,
    score,
    matchQuality,
    summary,
    reasons,
    warnings,
    window,
    distanceMiles,
  } = recommendation;

  const displayScore = Number.isFinite(score) ? Math.round(score) : 0;

  // Match quality colors
  const matchQualityColors = {
    perfect: "bg-green-500 text-white",
    excellent: "bg-blue-500 text-white",
    good: "bg-yellow-500 text-white",
    fair: "bg-gray-500 text-white",
  };

  return (
    <Card
      className={cn(
        "w-full hover:shadow-lg transition-shadow",
        rank === 1 && "border-2 border-blue-500"
      )}
      data-testid={`discovery-card-${beach.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {rank === 1 && (
                <Badge variant="default" className="bg-blue-600">
                  Top Pick
                </Badge>
              )}
              {rank <= 3 && rank !== 1 && (
                <Badge variant="outline">#{rank}</Badge>
              )}
              <Badge className={matchQualityColors[matchQuality]}>
                {matchQuality.charAt(0).toUpperCase() + matchQuality.slice(1)}
              </Badge>
            </div>
            <CardTitle className="text-xl flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              {beach.name}
            </CardTitle>
            {distanceMiles !== undefined && (
              <p className="text-sm text-gray-600 mt-1">
                {Math.round(distanceMiles)} miles away
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">
              {displayScore}
            </div>
            <div className="text-xs text-gray-500">match score</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <p className="text-sm text-gray-700">{summary}</p>

        {/* Best Window */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span>
            {format(window.start, "EEE h:mm a")} -{" "}
            {format(window.end, "h:mm a")}
          </span>
        </div>

        {/* Conditions */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-blue-500" />
            <span>{window.waveHeight}</span>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-gray-500" />
            <span>{window.wind}</span>
          </div>
        </div>

        {/* Reasons */}
        {reasons.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
              <TrendingUp className="h-4 w-4" />
              Why this spot:
            </div>
            <ul className="text-sm text-gray-600 space-y-1 pl-5">
              {reasons.slice(0, 3).map((reason, i) => (
                <li key={i} className="list-disc">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              Heads up:
            </div>
            <ul className="text-sm text-yellow-600 space-y-1 pl-5">
              {warnings.map((warning, i) => (
                <li key={i} className="list-disc">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => onPlanSession(beach.id)}
          >
            Plan Session
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewBeach(beach.id)}
          >
            View Beach
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
