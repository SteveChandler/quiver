"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Waves } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { SessionWithDetails } from "@/types/database";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { PartialContentGate } from "@/components/ui/partial-content-gate";
import { GradientEmptyState } from "@/components/ui/gradient-empty-state";

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

  if (!loading && sessions.length === 0) {
    if (publicMode) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No public sessions yet.
            </p>
          </CardContent>
        </Card>
      );
    }

    return null;
  }

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

        {publicMode && previewSessions.length > 0 ? (
          /* Horizontal scroll carousel in public mode */
          <div
            className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-2 px-2"
            tabIndex={0}
            role="region"
            aria-label="Recent surf sessions"
          >
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

