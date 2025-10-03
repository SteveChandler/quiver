"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckInFeed } from "@/components/ui/check-in-display";
import { CheckInDialog } from "@/components/ui/check-in-form";
import {
  useRecentCheckIns,
  useForecastAccuracyStats,
} from "@/hooks/use-check-ins";
import { Loader2, Waves, ThumbsUp, Plus } from "lucide-react";

interface BeachCheckInsProps {
  beachId: string;
  beachName: string;
}

export function BeachCheckIns({ beachId, beachName }: BeachCheckInsProps) {
  const [showForm, setShowForm] = useState(false);
  const { data: checkIns = [], loading, refetch } = useRecentCheckIns(beachId);
  const { data: accuracy } = useForecastAccuracyStats(beachId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Waves className="h-4 w-4" /> Real-time reports from surfers like you
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Your Check-in
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <CheckInFeed
          checkIns={checkIns}
          emptyMessage="No recent condition reports. Be the first to check in!"
        />
      )}

      {accuracy && accuracy.total_reports > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5" /> Forecast Accuracy Voting
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Past {accuracy.total_reports} votes —{" "}
            {Math.round(accuracy.accuracy_percentage)}% marked accurate
          </CardContent>
        </Card>
      )}

      {showForm && (
        <CheckInDialog
          isOpen={showForm}
          beachId={beachId}
          beachName={beachName}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
