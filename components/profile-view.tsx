"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  LogOut,
  CalendarDays,
  ImageIcon,
  WavesIcon as Surfboard,
  Plus,
  Loader2,
  MapPin,
  Instagram,
  Edit,
  AlertCircle,
  RefreshCw,
  Heart,
  MessageSquare,
} from "lucide-react";
import { FullPageLoader, AuthLoader } from "@/components/ui/loading-states";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { BoardCard } from "@/components/board-card";
import { UserStats } from "@/components/user-stats";
import { FavoriteBeaches } from "@/components/favorite-beaches";
import { UserAvatar } from "@/components/user-avatar";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { BoardsManager } from "@/components/profile/boards-manager";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { getUserBoards } from "@/actions/board-actions";
import { getUserSessions } from "@/actions/session-actions";
import { getProfile } from "@/actions/profile-actions";
import type { Board, SessionWithDetails, Profile } from "@/types/database";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { UserComments } from "@/components/profile/user-comments";
import { JournalView } from "@/components/journal/journal-view";

export function ProfileView() {
  const { user, signOut, isLoading: authLoading, refreshSession } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      // Use the API route to sign out (which will clear cookies)
      await fetch("/api/auth/supabase", {
        method: "DELETE",
        credentials: "include",
      });

      // Also call signOut to update the local auth state
      await signOut();
      router.push("/auth/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const loadUserData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch user profile
      const profileResult = await getProfile(user.id);
      if (
        profileResult.success &&
        "data" in profileResult &&
        profileResult.data
      ) {
        const profileData = profileResult.data as Profile;

        setProfile(profileData);
      } else {
        if (
          "isConnectionError" in profileResult &&
          profileResult.isConnectionError
        ) {
          setError(
            "Connection to the database failed. Please try again later."
          );
        } else {
          setError(profileResult.error || "Failed to load profile");
        }
        return; // Stop loading other data if profile fetch fails
      }

      // Fetch user boards
      const boardsResult = await getUserBoards(user.id);
      if (boardsResult.success && boardsResult.data) {
        setBoards(boardsResult.data);
      } else {
        console.error("Error loading boards:", boardsResult.error);
      }

      // Fetch user sessions
      const sessionsResult = await getUserSessions(user.id);
      if (sessionsResult.success && sessionsResult.data) {
        setSessions(sessionsResult.data);
      } else {
        console.error("Error loading sessions:", sessionsResult.error);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      setError("Failed to load user data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdated = async () => {
    console.log(
      "handleProfileUpdated called - reloading data and closing modal"
    );
    // Reload the user data to get the updated profile
    await loadUserData();
    // Close the modal
    setEditModalOpen(false);
    console.log("Modal should now be closed");
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  useEffect(() => {
    if (user) {
      loadUserData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, retryCount, authLoading]);

  // Show loading state while checking authentication
  if (authLoading || (loading && !error)) {
    return <FullPageLoader text="Loading profile..." />;
  }

  // If not authenticated, show loading spinner (middleware should handle redirect)
  if (!user && !authLoading) {
    return <AuthLoader />;
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <h1 className="text-xl font-bold">Profile</h1>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditModalOpen(true)}
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6 space-y-6 overflow-auto pb-20">
        {error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Button onClick={handleRetry} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Profile Info */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <UserAvatar
                    src={profile?.avatar_url}
                    name={profile?.full_name}
                    email={user?.email}
                    size="xl"
                  />
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-2xl font-bold">
                      {profile?.full_name || "Surfer"}
                    </h2>
                    <p className="text-muted-foreground">{user?.email}</p>

                    {/* Bio */}
                    {profile?.bio && (
                      <p className="text-sm mt-2 max-w-md">{profile.bio}</p>
                    )}

                    {/* Additional Profile Info */}
                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3 text-sm text-muted-foreground">
                      {profile?.location && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>{profile.location}</span>
                        </div>
                      )}

                      {profile?.experience_level && (
                        <div className="flex items-center">
                          <Surfboard className="h-4 w-4 mr-1" />
                          <span>{profile.experience_level}</span>
                        </div>
                      )}

                      {profile?.instagram && (
                        <div className="flex items-center">
                          <Instagram className="h-4 w-4 mr-1" />
                          <span>{profile.instagram}</span>
                        </div>
                      )}
                    </div>

                    {/* Favorite Spot */}
                    {profile?.favorite_spot && (
                      <div className="text-sm mt-2">
                        <span className="text-muted-foreground">
                          Favorite spot:{" "}
                        </span>
                        <span>{profile.favorite_spot}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 sm:mt-0">
                    <Button
                      variant="outline"
                      onClick={() => setEditModalOpen(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Stats */}
            {user && <UserStats userId={user.id} />}

            {/* Tabs */}
            <Tabs defaultValue="sessions" className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="sessions">
                  <CalendarDays className="h-4 w-4 mr-1" />
                  Journal+
                </TabsTrigger>
                <TabsTrigger value="quiver">
                  <Surfboard className="h-4 w-4 mr-1" />
                  Quiver
                </TabsTrigger>
                <TabsTrigger value="beaches">
                  <Heart className="h-4 w-4 mr-1" />
                  Beaches
                </TabsTrigger>
                <TabsTrigger value="comments">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Comments
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sessions" className="space-y-4">
                <JournalView />
              </TabsContent>

              <TabsContent value="quiver" className="space-y-4">
                {user && <BoardsManager userId={user.id} boards={boards} />}
              </TabsContent>

              <TabsContent value="beaches" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Favorite Beaches</h3>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditModalOpen(true);
                      // Set active tab to beaches after a short delay
                      setTimeout(() => {
                        const tabsElement =
                          document.querySelector('[role="tablist"]');
                        const beachesTab = tabsElement?.querySelector(
                          '[data-value="beaches"]'
                        );
                        if (beachesTab instanceof HTMLElement) {
                          beachesTab.click();
                        }
                      }, 100);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Beach
                  </Button>
                </div>

                <FavoriteBeaches />
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                {user && <UserComments userId={user.id} />}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* Edit Profile Modal */}
      <EditProfileModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        profile={profile}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}
