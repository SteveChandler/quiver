"use client";

import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";

const RecentSessionsSection = dynamic(
  () =>
    import("@/components/beach-detail/recent-sessions-section").then(
      (m) => m.RecentSessionsSection
    ),
  { ssr: false }
);

const SessionForecastComparison = dynamic(
  () =>
    import("@/components/forecast/session-forecast-comparison").then(
      (m) => m.SessionForecastComparison
    ),
  { ssr: false }
);

interface SessionSnapshot {
  id: string;
  forecast_snapshot: Record<string, any>;
  actual_conditions: Record<string, any>;
  created_at: string;
}

interface SessionsTabProps {
  beach: Beach;
  sessionSnapshots?: SessionSnapshot[] | null;
}

export function SessionsTab({ beach, sessionSnapshots }: SessionsTabProps) {
  return (
    <div className="space-y-6 py-6">
      {/* Recent Sessions */}
      <RecentSessionsSection beachId={beach.id} />

      {/* Forecast Accuracy Comparison */}
      {sessionSnapshots && sessionSnapshots.length > 0 && (
        <section className="rounded-3xl bg-white/95 p-6 shadow-lg backdrop-blur">
          <h2 className="text-xl font-roboto font-semibold text-dark-grey mb-4">
            Forecast Accuracy
          </h2>
          <SessionForecastComparison
            snapshots={sessionSnapshots}
            maxItems={10}
            className="bg-white/80 backdrop-blur-sm border-ocean-blue/20"
          />
        </section>
      )}
    </div>
  );
}
