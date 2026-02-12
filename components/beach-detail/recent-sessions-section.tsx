"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Waves } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { SessionWithDetails } from "@/types/database";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { PartialContentGate } from "@/components/ui/partial-content-gate";

interface RecentSessionsSectionProps {
  beachId: string;
  publicMode?: boolean;
  previewCount?: number;
}

export function RecentSessionsSection({
  beachId,
  publicMode = false,
  previewCount = 2,
}: RecentSessionsSectionProps) {
  const fetchSessions = useCallback(async (): Promise<SessionWithDetails[]> => {
    const res = await fetch(`/api/beaches/${beachId}/sessions?limit=5`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Failed to fetch recent sessions: ${res.status}`);
    }
    const json = await res.json();
    return (json?.data?.sessions || json?.sessions || []) as SessionWithDetails[];
  }, [beachId]);

  const { data: sessionsData, loading, error } = useDataFetcher(fetchSessions, { immediate: true, initialData: [] });
  const sessions = sessionsData ?? [];

  const previewSessions = publicMode ? sessions.slice(0, previewCount) : sessions;
  const hasMore = publicMode && sessions.length > previewCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions...
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 p-6 text-center">
            <Waves className="h-8 w-8 text-ocean-blue mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 mb-1">No sessions logged yet</p>
            <p className="text-xs text-gray-600">
              Surfed here? Log your session to share conditions with the community.
            </p>
          </div>
        )}

        {publicMode && previewSessions.length > 0 ? (
          /* Horizontal scroll carousel in public mode */
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-2 px-2">
            {previewSessions.map((s) => (
              <div
                key={s.id}
                className="flex-shrink-0 w-[280px] snap-start transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.02]"
              >
                <SessionCardWrapper session={s} isOwner={false} showUserInfo={true} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {previewSessions.map((s) => (
              <SessionCardWrapper key={s.id} session={s} isOwner={false} showUserInfo={true} />
            ))}
          </div>
        )}

        {hasMore && (
          <PartialContentGate
            contentType="sessions"
            totalCount={sessions.length}
            previewCount={previewCount}
          />
        )}

        {error && <div className="text-sm text-red-600">{String(error)}</div>}
      </CardContent>
    </Card>
  );
}


