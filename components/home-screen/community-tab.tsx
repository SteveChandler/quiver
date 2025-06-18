"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { ActivityFeed } from "@/components/social/activity-feed";
import { useAuth } from "@/context/auth-context";
import { Users, Activity } from "lucide-react";
import type { SessionWithDetails } from "@/types/database";

interface CommunityTabProps {
  sessions: SessionWithDetails[];
  loading: boolean;
}

export function CommunityTab({ sessions, loading }: CommunityTabProps) {
  const { user } = useAuth();

  if (loading) {
    return <CenteredLoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Activity Feed
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Users className="h-4 w-4 mr-2" />
            Recent Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <ActivityFeed userId={user?.id} autoRefresh={true} limit={25} />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No sessions yet</p>
              <p className="text-sm">
                Follow other surfers to see their sessions here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <SessionCardWrapper
                  key={session.id}
                  session={session}
                  isOwner={false}
                  showUserInfo={true}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
