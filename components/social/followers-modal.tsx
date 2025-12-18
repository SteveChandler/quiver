"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "./follow-button";
import { getUserFollowers, getUserFollowing } from "@/actions/social-actions";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

interface FollowersModalProps {
  userId: string;
  type: "followers" | "following";
  isOpen: boolean;
  onClose: () => void;
}

interface ConnectionProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export function FollowersModal({
  userId,
  type,
  isOpen,
  onClose,
}: FollowersModalProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchConnections = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result =
          type === "followers"
            ? await getUserFollowers(userId, 100)
            : await getUserFollowing(userId, 100);

        if (result.success) {
          setConnections((result.data ?? []) as ConnectionProfile[]);
        } else {
          setError(result.error || "Failed to load connections");
        }
      } catch (error) {
        console.error("Error fetching connections:", error);
        setError("Failed to load connections");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConnections();
  }, [isOpen, userId, type]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {type === "followers" ? "Followers" : "Following"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-8">
              <CenteredLoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()} // eslint-disable-line no-restricted-properties
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No {type === "followers" ? "followers" : "following"} yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((displayUser) => {
                return (
                  <div
                    key={displayUser.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Link
                        href={`/profile/${displayUser.id}`}
                        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                        onClick={onClose}
                      >
                        <UserAvatar
                          src={displayUser.avatar_url}
                          name={displayUser.full_name}
                          email={displayUser.email}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {displayUser.full_name || "Anonymous User"}
                          </p>
                          {displayUser.email && (
                            <p className="text-sm text-muted-foreground truncate">
                              {displayUser.email}
                            </p>
                          )}
                        </div>
                      </Link>
                    </div>

                    {/* Show follow button if this is not the current user */}
                    {user && user.id !== displayUser.id && (
                      <FollowButton
                        userId={displayUser.id}
                        size="sm"
                        variant="outline"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
