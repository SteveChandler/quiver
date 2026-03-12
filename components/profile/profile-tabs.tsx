"use client";

import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  WavesIcon as Surfboard,
  Heart,
  MessageSquare,
  User,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import { TabLoadingSkeleton } from "./loading-skeletons";
import type { Board, Beach } from "@/types/database";
import type { ProfilePageProfile, ProfilePagePreferences } from "@/types/profile-page";

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
const SurfProfileSection = lazy(() =>
  import("@/components/profile/surf-profile-section").then((m) => ({
    default: m.SurfProfileSection,
  }))
);
const FavoriteBeaches = lazy(() =>
  import("@/components/favorite-beaches").then((m) => ({
    default: m.FavoriteBeaches,
  }))
);

interface ProfileTabsProps {
  userId: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  boards: Board[];
  profile: ProfilePageProfile;
  preferences: ProfilePagePreferences;
  beaches: Beach[];
}

/**
 * ProfileTabs - Tab navigation and content containers for profile page
 *
 * Tabs:
 * 1. Journal+ (sessions) - JournalView
 * 2. Quiver (boards) - BoardsManager
 * 3. Beaches (favorites) - FavoriteBeaches
 * 4. Comments - UserComments
 * 5. Profile (surf preferences) - SurfProfileSection
 *
 * All tab content is lazy loaded for better initial performance.
 */
export function ProfileTabs({
  userId,
  activeTab,
  onTabChange,
  boards,
  profile,
  preferences,
  beaches,
}: ProfileTabsProps) {
  const router = useRouter();

  return (
    <motion.section
      {...ANIMATION_VARIANTS.fadeUpWithDelay(0.3)}
      className="max-w-6xl mx-auto px-2 sm:px-4"
    >
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="space-y-8"
      >
        <TabsList className="grid grid-cols-5 w-full h-14 lg:h-16 bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 shadow-lg">
          <TabsTrigger
            value="sessions"
            className="text-sm lg:text-base font-heading data-[state=active]:bg-gradient-to-r data-[state=active]:from-ocean-blue data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-300 rounded-lg"
          >
            <CalendarDays className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
            Journal+
          </TabsTrigger>
          <TabsTrigger
            value="quiver"
            className="text-sm lg:text-base font-heading data-[state=active]:bg-gradient-to-r data-[state=active]:from-sunset-orange data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all duration-300 rounded-lg"
          >
            <Surfboard className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
            Quiver
          </TabsTrigger>
          <TabsTrigger
            value="beaches"
            className="text-sm lg:text-base font-heading data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white transition-all duration-300 rounded-lg"
          >
            <Heart className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
            Beaches
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="text-sm lg:text-base font-heading data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all duration-300 rounded-lg"
          >
            <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
            Comments
          </TabsTrigger>
          <TabsTrigger
            value="surf-profile"
            className="text-sm lg:text-base font-heading data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all duration-300 rounded-lg"
          >
            <User className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
            Profile
          </TabsTrigger>
        </TabsList>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg overflow-hidden">
          <TabsContent value="sessions" className="p-4 sm:p-6 space-y-4 m-0">
            <Suspense fallback={<TabLoadingSkeleton type="Journal" />}>
              <JournalView />
            </Suspense>
          </TabsContent>

          <TabsContent value="quiver" className="p-4 sm:p-6 space-y-4 m-0">
            <Suspense fallback={<TabLoadingSkeleton type="Boards" />}>
              <BoardsManager userId={userId} boards={boards} />
            </Suspense>
          </TabsContent>

          <TabsContent value="beaches" className="p-4 sm:p-6 space-y-4 m-0">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-heading font-semibold text-dark-grey">
                Favorite Beaches
              </h3>
              <Button
                data-testid="add-beach-button"
                size="sm"
                onClick={() => {
                  router.push("/map");
                }}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-emerald-500 hover:to-green-600 text-white font-heading font-medium rounded-full transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Beach
              </Button>
            </div>
            <Suspense fallback={<TabLoadingSkeleton type="Beaches" />}>
              <FavoriteBeaches />
            </Suspense>
          </TabsContent>

          <TabsContent value="comments" className="p-4 sm:p-6 space-y-4 m-0">
            <Suspense fallback={<TabLoadingSkeleton type="Comments" />}>
              <UserComments userId={userId} />
            </Suspense>
          </TabsContent>

          <TabsContent
            value="surf-profile"
            className="p-4 sm:p-6 space-y-4 m-0"
          >
            <Suspense fallback={<TabLoadingSkeleton type="Surf Profile" />}>
              <SurfProfileSection />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </motion.section>
  );
}
