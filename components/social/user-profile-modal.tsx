"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/social/follow-button";
import { UserStats } from "@/components/user-stats";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { data as gateway } from "@/lib/data/client";
import {
  MapPin,
  Instagram,
  WavesIcon,
  Calendar,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { SessionWithDetails } from "@/types/database";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({
  userId,
  isOpen,
  onClose,
}: UserProfileModalProps) {
  // Use a relaxed profile type: minimal core fields + optional extras
  type ModalProfile = {
    id: string;
    full_name: string | null;
    home_beach_id: string | null;
    homeBeachName?: string | null;
    home_beach?: { id: string; name: string } | null;
    avatar_url?: string | null;
    email?: string | null;
    bio?: string | null;
    location?: string | null;
    experience_level?: string | null;
    instagram?: string | null;
  };

  const [profile, setProfile] = useState<ModalProfile | null>(null);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // No local beach lookup; use DTO fields from profile

  const loadUserData = useCallback(async () => {
    if (!userId || !isOpen) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch user profile via data gateway
      const p = await gateway.users.profile.get(userId);
      setProfile(p as ModalProfile);

      // Fetch user's recent sessions (limit to 5 for modal) via data gateway
      const s = await gateway.users.sessions.list(userId, 5);
      setSessions(s as SessionWithDetails[]);
    } catch (error) {
      console.error("Error loading user data:", error);
      setError("Failed to load user profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId, isOpen]);

  const handleRetry = useCallback(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserData();
    } else if (!isOpen) {
      // Reset state when modal closes
      setProfile(null);
      setSessions([]);
      setError(null);
    }
  }, [isOpen, userId, loadUserData]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Surfer Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8">
            <CenteredLoadingSpinner />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Button onClick={handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            {/* Profile Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <UserAvatar
                    src={profile.avatar_url}
                    name={profile.full_name}
                    email={profile.email}
                    size="xl"
                  />
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-xl font-bold">
                      {profile.full_name || "Surfer"}
                    </h2>
                    {profile.email && (
                      <p className="text-muted-foreground text-sm">
                        {profile.email}
                      </p>
                    )}

                    {/* Bio */}
                    {profile.bio && (
                      <p className="text-sm mt-2 max-w-md">{profile.bio}</p>
                    )}

                    {/* Additional Profile Info */}
                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3 text-sm text-muted-foreground">
                      {profile.location && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>{profile.location}</span>
                        </div>
                      )}

                      {profile.experience_level && (
                        <div className="flex items-center">
                          <WavesIcon className="h-4 w-4 mr-1" />
                          <span>{profile.experience_level}</span>
                        </div>
                      )}

                      {profile.instagram && (
                        <div className="flex items-center">
                          <Instagram className="h-4 w-4 mr-1" />
                          <span>{profile.instagram}</span>
                        </div>
                      )}
                    </div>

                    {/* Home Break - prefer DTO name, fallback to joined relation */}
                    {(profile.homeBeachName ?? profile.home_beach?.name) && (
                      <div className="text-sm mt-2">
                        <span className="text-muted-foreground">Home Break{" "}</span>
                        <span>{profile.homeBeachName ?? profile.home_beach?.name ?? "—"}</span>
                      </div>
                    )}
                  </div>

                  {/* Follow Button */}
                  <div className="mt-2 sm:mt-0">
                    <FollowButton
                      userId={userId}
                      variant="default"
                      size="sm"
                      showCounts={true}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Stats */}
            <UserStats userId={userId} />

            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Recent Sessions
                </h3>
                <div className="space-y-3">
                  {sessions.slice(0, 3).map((session) => (
                    <SessionCardWrapper
                      key={session.id}
                      session={session}
                      isOwner={false}
                      showUserInfo={false}
                    />
                  ))}
                </div>
                {sessions.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center">
                    And {sessions.length - 3} more sessions...
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Profile not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
