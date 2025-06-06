"use client";

import { Loader2 } from "lucide-react";
import { SessionCard } from "@/components/session-card";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import type { SessionWithDetails } from "@/types/database";

interface CommunityTabProps {
  sessions: SessionWithDetails[];
  loading: boolean;
}

export function CommunityTab({ sessions, loading }: CommunityTabProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
      {sessions.map((session) => {
        // Get beach coordinates using the unified resolution function
        const coords = session.beach
          ? resolveBeachCoordinates(session.beach)
          : null;

        // Generate the map image URL
        const mapImageUrl = getStaticMapImageUrl(
          coords?.latitude,
          coords?.longitude,
          { width: 300, height: 200, zoom: 15 }
        );

        return (
          <SessionCard
            key={session.id}
            username={session.user?.full_name || "Anonymous Surfer"}
            beachName={session.beach?.name || "Unknown Beach"}
            date={
              session.arrival_time
                ? new Date(session.arrival_time).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "No date"
            }
            rating={session.rating || 0}
            description={session.notes || "No description provided."}
            imageUrl={mapImageUrl}
            likes={0}
            comments={0}
          />
        );
      })}
    </div>
  );
}
