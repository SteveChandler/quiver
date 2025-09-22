"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CrowdTipsSectionProps {
  beachId: string;
}

export function CrowdTipsSection({ beachId }: CrowdTipsSectionProps) {
  // Placeholder for now: reuse Local Intel concept but with copy tailored to crowd etiquette.
  // Could be expanded to filter intel posts by a "crowd" tag.
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crowd Tips</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Share local etiquette and crowd tips for this spot. Keep it friendly and helpful.
        </div>
      </CardContent>
    </Card>
  );
}


