"use client";

import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import type { SessionWithDetails } from "@/types/database";

interface CommunityTabProps {
  sessions: SessionWithDetails[];
  loading: boolean;
}

export function CommunityTab({ sessions, loading }: CommunityTabProps) {
  if (loading) {
    return <CenteredLoadingSpinner />;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No community sessions found
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {sessions.map((session) => (
        <SessionCardWrapper
          key={session.id}
          session={session}
          isOwner={false}
          showUserInfo={true}
        />
      ))}
    </div>
  );
}
