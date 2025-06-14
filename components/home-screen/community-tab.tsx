"use client";

import { Loader2 } from "lucide-react";
import { SessionCard } from "@/components/session-card";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import type { SessionWithDetails } from "@/types/database";
import { CommunityComments } from "@/components/community-comments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, MessageSquare } from "lucide-react";

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

  return (
    <Tabs defaultValue="sessions" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="sessions">
          <CalendarDays className="h-4 w-4 mr-2" />
          Sessions
        </TabsTrigger>
        <TabsTrigger value="comments">
          <MessageSquare className="h-4 w-4 mr-2" />
          Comments
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sessions" className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No community sessions found
          </div>
        ) : (
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
                  id={session.id}
                  username={session.user?.full_name || "Anonymous Surfer"}
                  beachName={session.beach?.name || "Unknown Beach"}
                  date={
                    session.arrival_time
                      ? new Date(session.arrival_time).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )
                      : "No date"
                  }
                  rating={session.rating || 0}
                  description={session.notes || "No description provided."}
                  imageUrl={mapImageUrl}
                  likes={session.likes_count || 0}
                  comments={session.comments_count || 0}
                />
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="comments">
        <CommunityComments />
      </TabsContent>
    </Tabs>
  );
}
