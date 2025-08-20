"use client";

import { useParams } from "next/navigation";
import { useState, useCallback } from "react";
import { ArrowLeft, MapPin, Calendar, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { FollowButton } from "@/components/social/follow-button";
import { UserSocialStats } from "@/components/social/user-social-stats";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const userId = params.id as string;
  // Fetch user profile via API
  const fetchProfile = useCallback(async () => {
    const response = await fetch(`/api/profile/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load user profile");
    }

    if (!data.success) {
      throw new Error(data.error || "Failed to load user profile");
    }

    return data.data;
  }, [userId]);

  const {
    data: profile,
    loading,
    error,
  } = useDataFetcher(fetchProfile, {
    immediate: !!userId,
  });

  // Check if this is the current user's own profile
  const isOwnProfile = profile?.isOwnProfile || currentUser?.id === userId;

  if (loading) {
    return (
      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-muted rounded-full"></div>
              <div className="flex-1">
                <div className="w-32 h-6 bg-muted rounded mb-2"></div>
                <div className="w-48 h-4 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">User Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The user profile you're looking for doesn't exist or isn't public.
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    // Still loading or no data yet - don't show error state
    return (
      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-muted rounded-full"></div>
              <div className="flex-1">
                <div className="w-32 h-6 bg-muted rounded mb-2"></div>
                <div className="w-48 h-4 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex items-start gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback className="text-xl">
              {profile.full_name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold mb-2">
              {profile.full_name || "Anonymous Surfer"}
            </h1>

            <div className="text-sm text-muted-foreground mb-4">
              Member since {new Date(profile.created_at).toLocaleDateString()}
            </div>

            <div className="flex items-center gap-4">
              {!isOwnProfile && (
                <FollowButton
                  userId={userId}
                  initialFollowersCount={profile.followers_count || 0}
                  initialFollowingCount={profile.following_count || 0}
                  showCounts={true}
                  variant="default"
                  size="md"
                />
              )}

              {isOwnProfile && (
                <Button onClick={() => router.push("/profile")}>
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary mb-1">
              {profile.session_count || 0}
            </div>
            <div className="text-sm text-muted-foreground">Sessions</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary mb-1">
              {profile.followers_count || 0}
            </div>
            <div className="text-sm text-muted-foreground">Followers</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary mb-1">
              {profile.following_count || 0}
            </div>
            <div className="text-sm text-muted-foreground">Following</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary mb-1">
              {profile.average_rating || "-"}
            </div>
            <div className="text-sm text-muted-foreground">Avg Rating</div>
          </CardContent>
        </Card>
      </div>

      {/* Favorite Beach */}
      {profile.favorite_spot && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Home Break
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h3 className="font-medium">{profile.favorite_spot}</h3>
                <p className="text-sm text-muted-foreground">
                  This surfer's go-to spot for sessions
                </p>
              </div>
              <Button variant="outline" size="sm">
                View Beach
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Sessions (if any) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No public sessions yet</p>
            <p className="text-sm">
              {isOwnProfile
                ? "Log some sessions to share your surf progress!"
                : "This user hasn't shared any public sessions yet."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
