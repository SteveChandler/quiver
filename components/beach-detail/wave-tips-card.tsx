"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WaveTipsCardProps {
  tips: string | null;
}

export function WaveTipsCard({ tips }: WaveTipsCardProps) {
  if (!tips) return null;

  return (
    <Card className="noise-texture overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-amber-50/60 dark:from-card dark:to-card border-amber-200/50 dark:border-amber-500/20 shadow-lg">
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50/80 to-yellow-50/80 dark:from-amber-500/10 dark:to-yellow-500/10 border-b border-amber-100/50 dark:border-amber-500/20">
        <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800 dark:text-foreground">
          <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Wave Tips
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tips}
        </p>
      </CardContent>
    </Card>
  );
}
