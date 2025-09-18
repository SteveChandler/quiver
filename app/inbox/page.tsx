"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Loader2, CalendarPlus, Check, XCircle } from "lucide-react";
import { BottomNavigation } from "@/components/bottom-navigation";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";

type Invitation = {
  id: string;
  status: "pending" | "accepted" | "declined";
  created_at?: string;
  message?: string | null;
  seen_at?: string | null;
  notificationErrors?: string[];
  session?: {
    id?: string;
    beach_name?: string | null;
    arrival_time?: string | null;
  } | null;
  inviter?: {
    id?: string;
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
};

export default function InboxPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const inFlightSeen = useRef(new Set<string>());

  const fetchInvites = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s safety timeout
    try {
      const res = await fetch(
        "/api/session-planner/invitations?type=received",
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );
      if (!res.ok) {
        // Try to surface API error message
        let apiErr = "Failed to load notifications";
        try {
          const j = await res.json();
          apiErr = j?.error || apiErr;
        } catch {}
        throw new Error(apiErr);
      }
      const json = await res.json();
      const all: Invitation[] = json?.data?.invitations || [];
      return all;
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const {
    data: invitations,
    loading,
    error,
    refetch,
  } = useDataFetcher<Invitation[]>(fetchInvites);

  const markInvitationsSeen = useCallback(async (ids: string[]) => {
    const unseen = ids.filter((id) => !inFlightSeen.current.has(id));
    if (unseen.length === 0) return;

    unseen.forEach((id) => inFlightSeen.current.add(id));

    try {
      await fetch("/api/session-planner/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markSeen: true, invitationIds: unseen }),
      });
    } catch (err) {
      unseen.forEach((id) => inFlightSeen.current.delete(id));
      console.error("Failed to mark invitations as seen", err);
    }
  }, []);

  useEffect(() => {
    if (!invitations || invitations.length === 0) return;
    if (!user?.id && !user?.email) return;

    const pendingUnseenIds = invitations
      .filter(
        (inv) =>
          inv.status === "pending" && (!inv.seen_at || inv.seen_at === null)
      )
      .map((inv) => inv.id);

    if (pendingUnseenIds.length > 0) {
      markInvitationsSeen(pendingUnseenIds);
    }
  }, [invitations, markInvitationsSeen, user?.id, user?.email]);

  useEffect(() => {
    if (!user?.id && !user?.email) return;

    const channels: RealtimeChannel[] = [];

    if (user?.id) {
      const userChannel = supabase
        .channel(`session_invitations_invitee_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_invitations",
            filter: `invitee_id=eq.${user.id}`,
          },
          () => {
            refetch();
          }
        )
        .subscribe();
      channels.push(userChannel);
    }

    const emailValue = user?.email?.toLowerCase();
    if (emailValue) {
      const encoded = encodeURIComponent(emailValue);
      const emailChannel = supabase
        .channel(`session_invitations_invitee_email_${encoded}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_invitations",
            filter: `invitee_email=eq.${emailValue}`,
          },
          () => {
            refetch();
          }
        )
        .subscribe();
      channels.push(emailChannel);
    }

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase, user?.id, user?.email, refetch]);

  const pending = useMemo(() => {
    return (invitations || []).filter((i) => i.status === "pending");
  }, [invitations]);

  const handleRespond = useCallback(
    async (invitationId: string, response: "accepted" | "declined") => {
      const res = await fetch("/api/session-planner/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, response }),
      });
      if (!res.ok) throw new Error("Failed to respond to invite");
      refetch();
    },
    [refetch]
  );

  return (
    <div className="container py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6 text-center">Inbox</h1>

        <div className="grid gap-4 pb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-purple-600" />
                Session Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : error ? (
                <div className="text-destructive">{error}</div>
              ) : pending.length === 0 ? (
                <div className="text-muted-foreground">
                  No pending invitations.
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between border rounded-md p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {inv.inviter?.full_name || "A surfer"} invited you to
                          surf
                          {inv.session?.beach_name
                            ? ` at ${inv.session.beach_name}`
                            : ""}
                          {(!inv.seen_at || inv.seen_at === null) && (
                            <Badge variant="secondary" className="shrink-0">
                              New
                            </Badge>
                          )}
                        </div>
                        {inv.session?.arrival_time && (
                          <div className="text-sm text-muted-foreground truncate">
                            When:{" "}
                            {new Date(
                              inv.session.arrival_time
                            ).toLocaleString()}
                          </div>
                        )}
                        {inv.message && (
                          <div className="text-sm text-muted-foreground truncate">
                            “{inv.message}”
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleRespond(inv.id, "accepted")}
                        >
                          <Check className="h-4 w-4 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRespond(inv.id, "declined")}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <BottomNavigation />
      </div>
    </div>
  );
}
