"use client";

import { UnifiedCommunityFeed } from "@/components/social/unified-community-feed";
import { useAuth } from "@/context/auth-context";
import type { SessionWithDetails } from "@/types/database";

interface CommunityTabProps {
  sessions: SessionWithDetails[];
  loading: boolean;
}

export function CommunityTab({ sessions, loading }: CommunityTabProps) {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto">
      <UnifiedCommunityFeed
        sessions={sessions}
        userId={user?.id}
        loading={loading}
      />
    </div>
  );
}
