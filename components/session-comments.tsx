"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { createClient } from "@/lib/supabase/client";
import { data as gateway } from "@/lib/data/client";
import type { Database } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { Trash2 } from "lucide-react";

type Comment = Database["public"]["Tables"]["comments"]["Row"] & {
  user: {
    full_name: string;
    avatar_url: string | null;
    email: string | null;
  };
};

interface SessionCommentsProps {
  sessionId: string;
  onCommentCountChange?: (count: number) => void;
}

export function SessionComments({
  sessionId,
  onCommentCountChange,
}: SessionCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  const fetchComments = async () => {
    try {
      const list = await gateway.sessions.comments.listTopLevel(sessionId);
      setComments(list || []);

      // Notify parent of comment count change
      if (onCommentCountChange) {
        onCommentCountChange((list || []).length);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();

    // Subscribe to changes
    const channel = supabase
      .channel("session_comments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, sessionId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    try {
      await gateway.sessions.comments.create(sessionId, newComment.trim());
      setNewComment("");
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await gateway.sessions.comments.delete(sessionId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comment Form */}
      {user && (
        <form onSubmit={handleSubmitComment} className="space-y-4">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !newComment.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Post Comment
            </Button>
          </div>
        </form>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-lg font-medium mb-2">No comments yet</p>
          <p className="text-sm">Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <Card key={comment.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <UserAvatar
                    src={comment.user.avatar_url}
                    name={comment.user.full_name}
                    email={comment.user.email}
                    size="md"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {comment.user.full_name}
                      </span>
                      {user?.id === comment.user_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
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
      )}
    </div>
  );
}
