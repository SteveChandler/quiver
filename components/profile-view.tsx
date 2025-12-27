"use client";

import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
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
  User,
} from "lucide-react";
import { FullPageLoader, AuthLoader } from "@/components/ui/loading-states";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { BoardCard } from "@/components/board-card";
import { UserStats } from "@/components/user-stats";
// Lazy load FavoriteBeaches to avoid eager importing server actions in E2E/SSR
const FavoriteBeaches = lazy(() =>
  import("@/components/favorite-beaches").then((m) => ({
    default: m.FavoriteBeaches,
  }))
);
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
// Client-server boundary: use client data gateway instead of importing server actions
import { data as gateway } from "@/lib/data/client";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
// Removed ad-hoc beach lookup; rely on DTO fields for home beach name
import type { Board, SessionWithDetails, Profile } from "@/types/database";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";

// Lazy load heavy tab components for better performance
const BoardsManager = lazy(() =>
  import("@/components/profile/boards-manager").then((m) => ({
    default: m.BoardsManager,
  }))
);
const UserComments = lazy(() =>
  import("@/components/profile/user-comments").then((m) => ({
    default: m.UserComments,
  }))
);
const JournalView = lazy(() =>
  import("@/components/journal/journal-view").then((m) => ({
    default: m.JournalView,
  }))
);
const EditProfileModal = lazy(() =>
  import("@/components/edit-profile-modal").then((m) => ({
    default: m.EditProfileModal,
  }))
);
const SurfProfileSection = lazy(() =>
  import("@/components/profile/surf-profile-section").then((m) => ({
    default: m.SurfProfileSection,
  }))
);

// Loading skeletons for tabs
function SessionsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 bg-gray-100 rounded-lg animate-pulse"
        ></div>
      ))}
    </div>
  );
}

function TabLoadingSkeleton({ type }: { type: string }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-gray-600">Loading {type}...</p>
        </div>
      </div>
      <div className="grid gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
}

// Internal component that uses useSearchParams
function ProfileViewContent() {
  const { user, isLoading: authLoading, refreshSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [boards, setBoards] = useState<Board[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Loading is derived from useDataFetcher below
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  // No local beach name state; prefer DTO fields on profile
  const [statsRefreshToken, setStatsRefreshToken] = useState(0);

  // Get active tab from URL or default to "sessions"
  const activeTab = searchParams?.get("tab") || "sessions";

  const fetchData = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    const profileData = await gateway.users.profile.get(user.id);

    setProfile(profileData as Profile);
    const userSessions = await gateway.users.sessions.list(user.id, 5);
    setSessions(userSessions as SessionWithDetails[]);

    // Fetch user boards
    const userBoards = await gateway.boards.list();
    setBoards(userBoards as Board[]);

    return {
      profile: profileData,
      sessions: userSessions,
      boards: userBoards,
    };
  }, [user]);

  const {
    loading: dataLoading,
    error: fetchError,
    refetch,
  } = useDataFetcher(fetchData, {
    immediate: true,
    skip: !user,
    onError: (msg) => setError(msg),
  });

  // Removed effect; home beach name provided by API DTO or joined relation

  const handleProfileUpdated = async () => {
    console.log(
      "handleProfileUpdated called - reloading data and closing modal"
    );
    try {
      // Close the modal first to show immediate response
      setEditModalOpen(false);

      // Reload the user data to get the updated profile
      await refetch();

      // Increment the stats refresh token to trigger UserStats refresh
      setStatsRefreshToken((prev) => prev + 1);

      console.log("Profile data reloaded and modal closed successfully");
    } catch (error) {
      console.error("Error during profile update callback:", error);
      // Still close the modal even if reload fails
      setEditModalOpen(false);
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  useEffect(() => {
    if (!user && !authLoading) {
      // Ensure previous errors don't persist when logging out
      setError(null);
    }
  }, [user, authLoading]);

  // Open edit modal if URL contains ?edit=true
  useEffect(() => {
    if (searchParams?.get("edit") === "true") {
      setEditModalOpen(true);
    }
  }, [searchParams]);

  // Show loading state while checking authentication
  if (authLoading || (dataLoading && !error && !fetchError)) {
    return <FullPageLoader text="Loading profile..." />;
  }

  // If not authenticated, show loading spinner (middleware should handle redirect)
  if (!user && !authLoading) {
    return <AuthLoader />;
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-background via-background to-ocean-blue/5">
      {/* Modern Header */}
      <motion.header
        {...ANIMATION_VARIANTS.fadeInView}
        className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-white/20 shadow-sm"
      >
        <div className="container flex items-center h-16 px-2 sm:px-4">
          <h1 className="text-xl font-roboto font-bold text-dark-grey flex items-center gap-2">
            <User className="h-5 w-5 text-ocean-blue" />
            {profile?.full_name
              ? `${profile.full_name}'s Profile`
              : "Your Profile"}
          </h1>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 py-6 sm:py-8 lg:py-10 space-y-8 sm:space-y-10 lg:space-y-12 overflow-auto pb-20">
        {error ? (
          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="max-w-4xl mx-auto px-2 sm:px-4 space-y-4"
          >
            <Alert
              variant="destructive"
              className="bg-red-50/80 backdrop-blur-sm border-red-200"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Button
                onClick={handleRetry}
                variant="outline"
                className="hover:bg-ocean-blue hover:text-white transition-colors duration-300"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Hero Profile Section */}
            <motion.section
              {...ANIMATION_VARIANTS.fadeUpWithDelay(0.1)}
              className="relative py-3 sm:py-4 lg:py-5"
            >
              {/* Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-ocean-blue/10 via-transparent to-sunset-orange/10" />

              <div className="relative max-w-3xl mx-auto px-2 sm:px-4">
                <Card className="overflow-hidden bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300 border-white/50">
                  <CardContent className="p-3 sm:p-4 lg:p-5">
                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                      <motion.div
                        {...ANIMATION_VARIANTS.staggerItem(0)}
                        className="flex-shrink-0"
                      >
                        <UserAvatar
                          data-testid="user-avatar"
                          src={profile?.avatar_url}
                          name={profile?.full_name}
                          email={user?.email}
                          size="md"
                          className="ring-1 ring-ocean-blue/20 shadow"
                        />
                      </motion.div>

                      <motion.div
                        {...ANIMATION_VARIANTS.staggerItem(1)}
                        className="flex-1 text-center sm:text-left space-y-1"
                      >
                        <h2 className="text-lg sm:text-xl font-roboto font-bold text-dark-grey">
                          {profile?.full_name || "Surfer"}
                        </h2>
                        <p className="text-sm text-muted-foreground font-open-sans">
                          {user?.email}
                        </p>

                        {/* Bio */}
                        {profile?.bio && (
                          <p className="text-xs sm:text-sm font-open-sans text-gray-600 max-w-md">
                            {profile.bio}
                          </p>
                        )}

                        {/* Profile Details */}
                        <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1 text-xs font-open-sans text-muted-foreground">
                          {profile?.location && (
                            <div className="flex items-center bg-ocean-blue/10 px-2 py-0.5 rounded-full">
                              <MapPin className="h-3 w-3 mr-1 text-ocean-blue" />
                              <span>{profile.location}</span>
                            </div>
                          )}

                          {profile?.experience_level && (
                            <div className="flex items-center bg-sunset-orange/10 px-2 py-0.5 rounded-full">
                              <Surfboard className="h-3 w-3 mr-1 text-sunset-orange" />
                              <span>{profile.experience_level}</span>
                            </div>
                          )}

                          {profile?.instagram && (
                            <div className="flex items-center bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-2 py-0.5 rounded-full">
                              <Instagram className="h-3 w-3 mr-1 text-purple-600" />
                              <span>{profile.instagram}</span>
                            </div>
                          )}
                        </div>

                        {/* Home Break */}
                        {profile?.home_beach_id && (
                          <div className="text-xs font-open-sans pt-0.5">
                            <span className="text-muted-foreground">
                              Home Break:{" "}
                            </span>
                            <span className="font-medium text-ocean-blue">
                              {(typeof (profile as any)?.homeBeachName ===
                                "string" &&
                                (profile as any).homeBeachName) ||
                                (typeof (profile as any)?.home_beach?.name ===
                                  "string" &&
                                  (profile as any).home_beach.name) ||
                                "Set"}
                            </span>
                          </div>
                        )}
                      </motion.div>

                      <motion.div
                        {...ANIMATION_VARIANTS.staggerItem(2)}
                        className="flex-shrink-0"
                      >
                        <Button
                          size="sm"
                          onClick={() => setEditModalOpen(true)}
                          className="bg-gradient-to-r from-ocean-blue to-blue-600 hover:from-blue-600 hover:to-ocean-blue text-white px-3 py-1.5 text-xs font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.section>

            {/* Enhanced User Stats */}
            <motion.section
              {...ANIMATION_VARIANTS.fadeUpWithDelay(0.2)}
              className="max-w-6xl mx-auto px-2 sm:px-4"
            >
              <div className="bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border border-white/50">
                {user && (
                  <UserStats
                    userId={user.id}
                    refreshToken={statsRefreshToken}
                  />
                )}
              </div>
            </motion.section>

            {/* Modern Tabs Section */}
            <motion.section
              {...ANIMATION_VARIANTS.fadeUpWithDelay(0.3)}
              className="max-w-6xl mx-auto px-2 sm:px-4"
            >
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  // Update URL to reflect active tab
                  const params = new URLSearchParams(
                    searchParams?.toString() || ""
                  );
                  params.set("tab", value);
                  router.replace(`/profile?${params.toString()}`, {
                    scroll: false,
                  });
                }}
                className="space-y-8"
              >
                <TabsList className="grid grid-cols-5 w-full h-14 lg:h-16 bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 shadow-lg">
                  <TabsTrigger
                    value="sessions"
                    className="text-sm lg:text-base font-roboto data-[state=active]:bg-gradient-to-r data-[state=active]:from-ocean-blue data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-300 rounded-lg"
                  >
                    <CalendarDays className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
                    Journal+
                  </TabsTrigger>
                  <TabsTrigger
                    value="quiver"
                    className="text-sm lg:text-base font-roboto data-[state=active]:bg-gradient-to-r data-[state=active]:from-sunset-orange data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all duration-300 rounded-lg"
                  >
                    <Surfboard className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
                    Quiver
                  </TabsTrigger>
                  <TabsTrigger
                    value="beaches"
                    className="text-sm lg:text-base font-roboto data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white transition-all duration-300 rounded-lg"
                  >
                    <Heart className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
                    Beaches
                  </TabsTrigger>
                  <TabsTrigger
                    value="comments"
                    className="text-sm lg:text-base font-roboto data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all duration-300 rounded-lg"
                  >
                    <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
                    Comments
                  </TabsTrigger>
                  <TabsTrigger
                    value="surf-profile"
                    className="text-sm lg:text-base font-roboto data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all duration-300 rounded-lg"
                  >
                    <User className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
                    Profile
                  </TabsTrigger>
                </TabsList>

                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg overflow-hidden">
                  <TabsContent
                    value="sessions"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    <Suspense fallback={<TabLoadingSkeleton type="Journal" />}>
                      <JournalView />
                    </Suspense>
                  </TabsContent>

                  <TabsContent
                    value="quiver"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    {user && (
                      <Suspense fallback={<TabLoadingSkeleton type="Boards" />}>
                        <BoardsManager userId={user.id} boards={boards} />
                      </Suspense>
                    )}
                  </TabsContent>

                  <TabsContent
                    value="beaches"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-roboto font-semibold text-dark-grey">
                        Favorite Beaches
                      </h3>
                      <Button
                        data-testid="add-beach-button"
                        size="sm"
                        onClick={() => {
                          router.push("/map");
                        }}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-emerald-500 hover:to-green-600 text-white font-roboto font-medium rounded-full transition-all duration-300"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Beach
                      </Button>
                    </div>
                    <Suspense fallback={<TabLoadingSkeleton type="Beaches" />}>
                      <FavoriteBeaches />
                    </Suspense>
                  </TabsContent>

                  <TabsContent
                    value="comments"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    {user && (
                      <Suspense
                        fallback={<TabLoadingSkeleton type="Comments" />}
                      >
                        <UserComments userId={user.id} />
                      </Suspense>
                    )}
                  </TabsContent>

                  <TabsContent
                    value="surf-profile"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    <Suspense
                      fallback={<TabLoadingSkeleton type="Surf Profile" />}
                    >
                      <SurfProfileSection />
                    </Suspense>
                  </TabsContent>
                </div>
              </Tabs>
            </motion.section>
          </>
        )}
      </main>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <Suspense fallback={null}>
          <EditProfileModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            profile={profile}
            onProfileUpdated={handleProfileUpdated}
          />
        </Suspense>
      )}
    </div>
  );
}

// Wrapper component with Suspense boundary for useSearchParams
export function ProfileView() {
  return (
    <Suspense fallback={<FullPageLoader text="Loading profile..." />}>
      <ProfileViewContent />
    </Suspense>
  );
}
