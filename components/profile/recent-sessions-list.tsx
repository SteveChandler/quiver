"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import type { SessionWithDetails } from "@/types/database";

interface RecentSessionsListProps {
  recentSessions: SessionWithDetails[];
}

export function RecentSessionsList({
  recentSessions,
}: RecentSessionsListProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sessions</CardTitle>
        <CardDescription>Your latest surf adventures</CardDescription>
      </CardHeader>
      <CardContent>
        {recentSessions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground">No sessions recorded yet.</p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => router.push("/log-session")}
            >
              Log Your First Session
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/sessions/${session.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{session.beach.name}</h3>
                    <div className="text-sm text-muted-foreground">
                      {session.session_date
                        ? format(new Date(session.session_date), "MMM d, yyyy")
                        : "No date"}
                    </div>
                  </div>
                  {session.status !== "planned" && !!session.rating && (
                    <StarRating rating={session.rating} size="sm" />
                  )}
                </div>

                {session.board && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">Board:</span>{" "}
                    {session.board.name}
                  </div>
                )}

                {session.description && (
                  <div className="text-sm mt-1 line-clamp-2 text-muted-foreground">
                    {session.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => router.push("/profile")}
        >
          View All Sessions
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
