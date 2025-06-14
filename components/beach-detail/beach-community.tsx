import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/components/session-card";
import { Users, Waves, CalendarDays, Loader2 } from "lucide-react";
import Link from "next/link";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import type { SessionWithDetails, Beach } from "@/types/database";

interface BeachCommunityProps {
  beach: Beach;
  sessions: SessionWithDetails[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function BeachCommunity({
  beach,
  sessions,
  isLoading,
  isAuthenticated,
}: BeachCommunityProps) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Community</h3>
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Community</h3>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="space-y-4">
              <div className="text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">
                  No sessions logged yet
                </p>
                <p className="text-sm">
                  Be the first to share your experience at {beach.name}!
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
                <Link
                  href={
                    isAuthenticated
                      ? `/log-session?beach=${beach.id}`
                      : "/auth/sign-in"
                  }
                  className="flex-1"
                >
                  <Button className="w-full">
                    <Waves className="h-4 w-4 mr-1" />
                    Log Session
                  </Button>
                </Link>
                <Link
                  href={
                    isAuthenticated
                      ? `/plan-session?beach=${beach.id}`
                      : "/auth/sign-in"
                  }
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full">
                    <CalendarDays className="h-4 w-4 mr-1" />
                    Plan Session
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Community</h3>
      <div className="space-y-4">
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
                  ? new Date(session.arrival_time).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
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
    </section>
  );
}
