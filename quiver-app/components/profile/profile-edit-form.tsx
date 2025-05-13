"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicProfileForm } from "./basic-profile-form";
import { BoardsManager } from "./boards-manager";
import { ProfilePreferences } from "./profile-preferences";
import { RecentSessionsList } from "./recent-sessions-list";
import type {
  Board,
  Beach,
  Profile,
  SessionWithDetails,
} from "@/types/database";

interface ProfileEditFormProps {
  userId: string;
  email: string;
  profile: Profile | null;
  boards: Board[];
  recentSessions: SessionWithDetails[];
  beaches: Beach[];
}

export function ProfileEditForm({
  userId,
  email,
  profile,
  boards,
  recentSessions,
  beaches,
}: ProfileEditFormProps) {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="boards">My Boards</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <BasicProfileForm userId={userId} email={email} profile={profile} />
          </TabsContent>

          <TabsContent value="boards" className="space-y-6">
            <BoardsManager userId={userId} boards={boards} />
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <ProfilePreferences
              userId={userId}
              profile={profile}
              beaches={beaches}
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-8">
        <RecentSessionsList recentSessions={recentSessions} />
      </div>
    </div>
  );
}
