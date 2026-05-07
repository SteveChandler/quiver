"use client";

import { Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TideConditionsCardProps {
  prose: string | null;
  preferredDirection: string | null;
}

const directionLabels: Record<string, string> = {
  rising: "Rising tide preferred",
  falling: "Falling tide preferred",
  slack: "Mid-tide preferred",
  either: "Works on any tide",
};

export function TideConditionsCard({
  prose,
  preferredDirection,
}: TideConditionsCardProps) {
  if (!prose) return null;

  const directionLabel = preferredDirection
    ? directionLabels[preferredDirection] || preferredDirection
    : null;

  return (
    <Card
      data-testid="tide-conditions-card"
      className="noise-texture overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg mt-6"
    >
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
        <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800">
          <Waves className="h-5 w-5 text-sky-500" />
          Best Tide Conditions
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {prose}
        </p>
        {directionLabel && (
          <Badge variant="secondary" className="text-xs">
            {directionLabel}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
