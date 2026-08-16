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
import { AuthLoader } from "@/components/ui/loading-states";
import { ProfileTabLoadingSkeleton } from "@/components/skeletons/profile-tab-loading-skeleton";
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
import { useUserPreferences } from "@/hooks/use-user-preferences";
// Client-server boundary: use client data gateway instead of importing server actions
import { data as gateway, invalidateProfileCache } from "@/lib/data/client";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
// Removed ad-hoc beach lookup; rely on DTO fields for home beach name
import type { Board, SessionWithDetails, Profile } from "@/types/database";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShareSheet } from "@/components/share";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import { track } from "@/lib/analytics";
import { buildSessionShareSheetData } from "@/lib/share/session-share";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { cn } from "@/lib/utils";

import { FeedHighlight } from "@/components/profile/FeedHighlight";
import { SetHomeBreakCta } from "@/components/profile/set-home-break-cta";

const PROFILE_TAB_BASE_CLASS =
  "profile-zine-tab-trigger min-h-12 rounded-sm border font-heading text-xs font-bold uppercase transition-colors sm:text-sm";

function getProfileTabClassName(
  activeTab: string,
  tab: string,
  extraClassName?: string
): string {
  return cn(
    PROFILE_TAB_BASE_CLASS,
    activeTab === tab
      ? "border-[#11100D] bg-[#11100D] text-[#F4EBD8] shadow-[2px_2px_0_rgba(17,16,13,0.25)]"
      : "border-[#11100D]/30 bg-[#F4EBD8] text-[#11100D] hover:bg-[#F78E42]/20",
    extraClassName
  );
}

// Lazy load the referral leaderboard
const ReferralLeaderboard = lazy(() =>
  import("@/components/profile/referral-leaderboard").then((m) => ({
    default: m.ReferralLeaderboard,
  }))
);

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
const CommunityPhotoRecovery = lazy(() =>
  import("@/components/profile/community-photo-recovery").then((m) => ({
    default: m.CommunityPhotoRecovery,
  }))
);

// Loading skeletons for tabs
function SessionsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 border-2 border-[#11100D]/25 bg-[#FBF6E8] animate-pulse"
        ></div>
      ))}
    </div>
  );
}

// Internal component that uses useSearchParams
function ProfileViewContent() {
  const { user, isLoading: authLoading, refreshSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: preferences } = useUserPreferences();
  const [boards, setBoards] = useState<Board[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Loading is derived from useDataFetcher below
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [scrollToNotifications, setScrollToNotifications] = useState(false);
  // No local beach name state; prefer DTO fields on profile
  const [statsRefreshToken, setStatsRefreshToken] = useState(0);

  // Get active tab from URL or default to "sessions"
  const activeTab = searchParams?.get("tab") || "sessions";

  // FeedHighlight: session ID from ?highlight= param, opened after session save
  const highlightSessionId = searchParams?.get("highlight") || null;
  const [highlightShareOpen, setHighlightShareOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    const profileData = await gateway.users.profile.get(user.id);

    setProfile(profileData as Profile);
    const userSessions = await gateway.users.sessions.list(
      user.id,
      highlightSessionId ? 20 : 5
    );
    setSessions(userSessions as SessionWithDetails[]);

    // Fetch user boards
    const userBoards = await gateway.boards.list();
    setBoards(userBoards as Board[]);

    return {
      profile: profileData,
      sessions: userSessions,
      boards: userBoards,
    };
  }, [user, highlightSessionId]);

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
    try {
      // Close the modal first to show immediate response
      setEditModalOpen(false);

      // Clear stale gateway cache so refetch hits the network
      if (user) {
        invalidateProfileCache(user.id);
      }

      // Reload the user data to get the updated profile
      await refetch();

      // Increment the stats refresh token to trigger UserStats refresh
      setStatsRefreshToken((prev) => prev + 1);
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

  // Extract URL params for controlled effect triggers
  const openSettings = searchParams?.get("openSettings") === "true";
  const editMode = searchParams?.get("edit") === "true";

  // Open edit modal if URL contains ?edit=true or ?openSettings=true
  useEffect(() => {
    if (editMode) {
      setEditModalOpen(true);
    } else if (openSettings) {
      setEditModalOpen(true);
      setScrollToNotifications(true);
      // Clean up URL after opening modal (remove openSettings param)
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.delete("openSettings");
      const newUrl = params.toString() ? `/profile?${params.toString()}` : "/profile";
      router.replace(newUrl, { scroll: false });
    }
  }, [editMode, openSettings, searchParams, router]);

  // Track surf profile analytics when preferences are shown
  useEffect(() => {
    if (preferences?.confidence !== undefined && preferences?.confidence > 0.5) {
      track("surf_profile_viewed", {
        confidence: preferences.confidence,
        sample_size: preferences.sample_size,
      });
    } else if (preferences) {
      track("surf_profile_progress_shown", {
        sessions_needed: Math.max(0, 5 - (preferences.sample_size || 0)),
      });
    }
  }, [preferences?.confidence, preferences?.sample_size, preferences]);

  const highlightedSession = highlightSessionId
    ? sessions.find((session) => session.id === highlightSessionId) ?? null
    : null;
  const highlightShareData = highlightedSession
    ? buildSessionShareSheetData(highlightedSession)
    : null;

  // Show loading state while checking authentication
  if (authLoading || (dataLoading && !error && !fetchError)) {
    return (
      <ZineSurface
        sectionLabel="Profile"
        editionLabel="Private logbook"
        paperClassName="min-h-[calc(100vh-9rem)]"
        data-testid="profile-loading-zine-surface"
      >
        <div className="flex min-h-[52vh] items-center justify-center">
          <div
            className="inline-flex items-center gap-3 border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)]"
            role="status"
            aria-label="Loading profile"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>Loading profile...</span>
          </div>
        </div>
      </ZineSurface>
    );
  }

  // If not authenticated, show loading spinner (middleware should handle redirect)
  if (!user && !authLoading) {
    return <AuthLoader />;
  }

  return (
    <ZineSurface
      sectionLabel="Profile"
      editionLabel="Private logbook"
      paperClassName="min-h-[calc(100vh-9rem)] px-4 py-5 sm:px-6 lg:px-8"
      data-testid="profile-zine-surface"
    >
      <div className="flex flex-col">
      {/* Profile masthead */}
      <motion.header
        {...ANIMATION_VARIANTS.fadeInView}
        className="sticky top-0 z-10 -mx-4 border-b-2 border-[#11100D] bg-[#F4EBD8]/95 px-4 py-3 shadow-[0_4px_0_rgba(17,16,13,0.12)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex min-h-12 items-center">
          <h1 className="flex items-center gap-2 font-heading text-xl font-black uppercase tracking-normal text-[#11100D]">
            <User className="h-5 w-5 text-[#F78E42]" />
            {profile?.full_name
              ? `${profile.full_name}'s Profile`
              : "Your Profile"}
          </h1>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 space-y-8 py-6 pb-20 sm:space-y-10 sm:py-8 lg:space-y-12 lg:py-10">
        {error ? (
          <motion.div
            {...ANIMATION_VARIANTS.fadeInView}
            className="mx-auto max-w-4xl space-y-4"
          >
            <Alert
              variant="destructive"
              className="border-2 border-[#11100D] bg-[#FBF6E8] text-[#11100D]"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Button
                onClick={handleRetry}
                variant="outline"
                className="border-2 border-[#11100D] bg-[#FBF6E8] font-heading font-bold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42]"
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
              <div className="relative mx-auto max-w-3xl">
                <QuiverSticker
                  sticker="orangeTape"
                  className="absolute -top-8 right-6 hidden w-32 rotate-6 opacity-90 sm:block"
                />
                <div className="torn torn-tb overflow-hidden border-2 border-[#11100D] bg-[#FBF6E8] p-3 shadow-[4px_5px_0_rgba(17,16,13,0.22)] sm:p-4 lg:p-5">
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
                          className="border-2 border-[#11100D] ring-2 ring-[#F78E42]/45 shadow-[2px_3px_0_rgba(17,16,13,0.22)]"
                        />
                      </motion.div>

                      <motion.div
                        {...ANIMATION_VARIANTS.staggerItem(1)}
                        className="flex-1 text-center sm:text-left space-y-1"
                      >
                        <h2 className="font-heading text-lg font-bold text-[#11100D] sm:text-xl">
                          {profile?.full_name || "Surfer"}
                        </h2>
                        <p className="break-all font-mono text-xs uppercase tracking-[0.08em] text-[#11100D]/60 sm:break-normal">
                          {user?.email}
                        </p>

                        {/* Bio */}
                        {profile?.bio && (
                          <p className="max-w-md font-sans text-xs leading-relaxed text-[#11100D]/70 sm:text-sm">
                            {profile.bio}
                          </p>
                        )}

                        {/* Profile Details */}
                        <div className="flex flex-wrap justify-center gap-2 pt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#11100D]/70 sm:justify-start">
                          {profile?.location && (
                            <div className="flex items-center rounded-full border border-[#11100D]/35 bg-[#F4EBD8] px-2 py-0.5">
                              <MapPin className="h-3 w-3 mr-1 text-[#11100D]" />
                              <span>{profile.location}</span>
                            </div>
                          )}

                          {profile?.experience_level && (
                            <div className="flex items-center rounded-full border border-[#11100D]/35 bg-[#F4EBD8] px-2 py-0.5">
                              <Surfboard className="h-3 w-3 mr-1 text-[#F78E42]" />
                              <span>{profile.experience_level}</span>
                            </div>
                          )}

                          {profile?.instagram && (
                            <div className="flex items-center rounded-full border border-[#11100D]/35 bg-[#F4EBD8] px-2 py-0.5">
                              <Instagram className="h-3 w-3 mr-1 text-[#11100D]" />
                              <span>{profile.instagram}</span>
                            </div>
                          )}
                        </div>

                        {/* Home Break */}
                        {profile?.home_beach_id && (
                          <div className="pt-0.5 font-mono text-xs uppercase tracking-[0.08em]">
                            <span className="text-[#11100D]/60">
                              Home Break:{" "}
                            </span>
                            <span className="font-bold text-[#11100D]">
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

                        {/* Surf Style Card */}
                        {preferences && (
                          <div className="mt-4 border-2 border-[#11100D] bg-[#F4EBD8] p-3 shadow-[2px_3px_0_rgba(17,16,13,0.18)]">
                            <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]">
                              Your Surf Style
                            </p>
                            {preferences.confidence > 0.5 ? (
                              <>
                                <p className="mt-1 font-heading text-sm font-bold text-[#11100D]">
                                  {preferences.wave_min_ft && preferences.wave_max_ft
                                    ? `${preferences.wave_min_ft}-${preferences.wave_max_ft}ft waves`
                                    : "Learning your preferences..."}
                                </p>
                                <p className="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-[#11100D]/60">
                                  Based on {preferences.sample_size} sessions
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="mt-1 font-heading text-sm font-bold text-[#11100D]">
                                  Log {Math.max(0, 5 - (preferences.sample_size || 0))} more sessions
                                  to unlock personalized recommendations
                                </p>
                                <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#11100D] bg-[#11100D]/10">
                                  <div
                                    className="h-full rounded-full bg-[#F78E42] transition-[width]"
                                    style={{
                                      width: `${Math.min(100, ((preferences.sample_size || 0) / 5) * 100)}%`,
                                    }}
                                  />
                                </div>
                              </>
                            )}
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
                          className="rounded-full border-2 border-[#11100D] bg-[#F78E42] px-3 py-1.5 font-heading text-xs font-bold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42]"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </motion.div>
                    </div>
                </div>
              </div>
            </motion.section>

            {/* Set up your home break CTA — only visible when home_beach_id is NULL.
                Re-opens the OnboardingDialog so users who tapped "Maybe later" during
                signup have a clear path back into the setup flow.
                See Fix 4 in plans/majestic-squishing-newell.md. */}
            {profile && !profile.home_beach_id && (
              <motion.section
                {...ANIMATION_VARIANTS.fadeUpWithDelay(0.15)}
                className="mx-auto max-w-6xl"
              >
                <SetHomeBreakCta />
              </motion.section>
            )}

            {/* Enhanced User Stats */}
            <motion.section
              {...ANIMATION_VARIANTS.fadeUpWithDelay(0.2)}
              className="mx-auto max-w-6xl"
            >
              <div className="border-2 border-[#11100D] bg-[#FBF6E8] p-4 shadow-[3px_4px_0_rgba(17,16,13,0.18)] sm:p-6">
                {user && (
                  <UserStats
                    userId={user.id}
                    refreshToken={statsRefreshToken}
                  />
                )}
              </div>
            </motion.section>

            {/* Referral Leaderboard */}
            <motion.section
              {...ANIMATION_VARIANTS.fadeUpWithDelay(0.25)}
              className="mx-auto max-w-6xl"
            >
              <Suspense fallback={null}>
                <ReferralLeaderboard />
              </Suspense>
            </motion.section>

            {/* Modern Tabs Section */}
            <motion.section
              {...ANIMATION_VARIANTS.fadeUpWithDelay(0.3)}
              className="mx-auto max-w-6xl"
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
                <TabsList className="grid h-auto w-full grid-cols-2 gap-2 border-2 border-[#11100D] bg-[#FBF6E8] p-2 shadow-[3px_4px_0_rgba(17,16,13,0.18)] sm:grid-cols-5">
                  <TabsTrigger
                    value="sessions"
                    className={getProfileTabClassName(activeTab, "sessions")}
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Journal+
                  </TabsTrigger>
                  <TabsTrigger
                    value="quiver"
                    className={getProfileTabClassName(activeTab, "quiver")}
                  >
                    <Surfboard className="h-4 w-4 mr-2" />
                    Quiver
                  </TabsTrigger>
                  <TabsTrigger
                    value="beaches"
                    className={getProfileTabClassName(activeTab, "beaches")}
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Beaches
                  </TabsTrigger>
                  <TabsTrigger
                    value="comments"
                    className={getProfileTabClassName(activeTab, "comments")}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Comments
                  </TabsTrigger>
                  <TabsTrigger
                    value="surf-profile"
                    className={getProfileTabClassName(
                      activeTab,
                      "surf-profile",
                      "col-span-2 sm:col-span-1"
                    )}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </TabsTrigger>
                </TabsList>

                <div className="profile-zine-tabs overflow-hidden border-2 border-[#11100D] bg-[#FBF6E8] shadow-[4px_5px_0_rgba(17,16,13,0.2)]">
                  <TabsContent
                    value="sessions"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    {highlightSessionId && (
                      <FeedHighlight
                        sessionId={highlightSessionId}
                        onShare={() => {
                          if (highlightShareData) {
                            setHighlightShareOpen(true);
                          }
                        }}
                        onDismiss={() => {
                          // Clean the highlight param from the URL without a full navigation
                          const params = new URLSearchParams(searchParams?.toString() ?? "");
                          params.delete("highlight");
                          const newUrl = params.toString() ? `/profile?${params.toString()}` : "/profile";
                          router.replace(newUrl, { scroll: false });
                        }}
                      />
                    )}
                    <Suspense fallback={<ProfileTabLoadingSkeleton type="Journal" />}>
                      <JournalView />
                    </Suspense>
                  </TabsContent>

                  <TabsContent
                    value="quiver"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    {user && (
                      <Suspense fallback={<ProfileTabLoadingSkeleton type="Boards" />}>
                        <BoardsManager userId={user.id} boards={boards} />
                      </Suspense>
                    )}
                  </TabsContent>

                  <TabsContent
                    value="beaches"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-heading text-xl font-semibold text-[#11100D]">
                        Favorite Beaches
                      </h3>
                      <Button
                        data-testid="add-beach-button"
                        size="sm"
                        onClick={() => {
                          router.push("/map");
                        }}
                        className="rounded-full border-2 border-[#11100D] bg-[#F78E42] font-heading font-bold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42]"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Beach
                      </Button>
                    </div>
                    <Suspense fallback={<ProfileTabLoadingSkeleton type="Beaches" />}>
                      <FavoriteBeaches />
                    </Suspense>
                  </TabsContent>

                  <TabsContent
                    value="comments"
                    className="p-4 sm:p-6 space-y-4 m-0"
                  >
                    {user && (
                      <Suspense
                        fallback={<ProfileTabLoadingSkeleton type="Comments" />}
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
                      fallback={<ProfileTabLoadingSkeleton type="Surf Profile" />}
                    >
                      <SurfProfileSection />
                    </Suspense>
                    <Suspense
                      fallback={<ProfileTabLoadingSkeleton type="Removed photos" />}
                    >
                      <CommunityPhotoRecovery />
                    </Suspense>
                  </TabsContent>
                </div>
              </Tabs>
            </motion.section>
          </>
        )}
      </main>

      {highlightShareData && (
        <ShareSheet
          open={highlightShareOpen}
          onOpenChange={setHighlightShareOpen}
          type="session"
          imageUrl={highlightShareData.imageUrl}
          filename={highlightShareData.filename}
          title={highlightShareData.title}
          text={highlightShareData.text}
          shareUrl={highlightShareData.shareUrl}
        />
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <Suspense fallback={null}>
          <EditProfileModal
            open={editModalOpen}
            onOpenChange={(open) => {
              setEditModalOpen(open);
              if (!open) {
                setScrollToNotifications(false);
              }
            }}
            profile={profile}
            onProfileUpdated={handleProfileUpdated}
            scrollToNotifications={scrollToNotifications}
          />
        </Suspense>
      )}
      </div>
    </ZineSurface>
  );
}

// Wrapper component with Suspense boundary for useSearchParams
export function ProfileView() {
  return (
    <Suspense
      fallback={
        <ZineSurface
          sectionLabel="Profile"
          editionLabel="Private logbook"
          paperClassName="min-h-[calc(100vh-9rem)]"
          data-testid="profile-suspense-zine-surface"
        >
          <div className="flex min-h-[52vh] items-center justify-center">
            <div
              className="inline-flex items-center gap-3 border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)]"
              role="status"
              aria-label="Loading profile"
            >
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span>Loading profile...</span>
            </div>
          </div>
        </ZineSurface>
      }
    >
      <ProfileViewContent />
    </Suspense>
  );
}
