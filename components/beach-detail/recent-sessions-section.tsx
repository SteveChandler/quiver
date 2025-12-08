"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { SessionWithDetails } from "@/types/database";
import { SessionCardWrapper } from "@/components/session-card-wrapper";

interface RecentSessionsSectionProps {
  beachId: string;
}

export function RecentSessionsSection({ beachId }: RecentSessionsSectionProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions...
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-sm text-muted-foreground">No recent sessions found.</div>
        )}

        {sessions.map((s) => (
          <SessionCardWrapper key={s.id} session={s} isOwner={false} showUserInfo={true} />
        ))}

        {error && <div className="text-sm text-red-600">{String(error)}</div>}
      </CardContent>
    </Card>
  );
}


