"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Comment = Database["public"]["Tables"]["comments"]["Row"] & {
  user: {
    full_name: string;
    avatar_url: string | null;
  };
  session: {
    beach: {
      name: string;
    } | null;
  };
};

export function CommunityComments() {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const { data, error } = await supabase
          .from("comments")
          .select(
            `
            *,
            user:profiles(full_name, avatar_url),
            session:sessions(beach:beaches(name))
          `
          )
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setComments(data || []);
      } catch (error) {
        console.error("Error fetching comments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();

    // Subscribe to new comments
    const channel = supabase
      .channel("comments")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
        },
        async (payload) => {
          // Fetch the full comment data including user and session info
          const { data, error } = await supabase
            .from("comments")
            .select(
              `
              *,
              user:profiles(full_name, avatar_url),
              session:sessions(beach:beaches(name))
            `
            )
            .eq("id", payload.new.id)
            .single();

          if (!error && data) {
            setComments((prev) => [data, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-lg font-medium mb-2">No comments yet</p>
        <p className="text-sm">Be the first to join the conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <Card key={comment.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar>
                <AvatarImage
                  src={comment.user.avatar_url || undefined}
                  alt={comment.user.full_name}
                />
                <AvatarFallback>
                  {comment.user.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{comment.user.full_name}</span>
                  <span className="text-sm text-muted-foreground">
                    commented on a session at{" "}
                    {comment.session.beach?.name || "Unknown Beach"}
                  </span>
                </div>
                <p className="mt-1 text-sm">{comment.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(comment.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
