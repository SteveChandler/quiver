"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FollowersModal } from "./followers-modal";
import type { Profile } from "@/types/database";

interface UserSocialStatsProps {
  profile: Profile;
  className?: string;
}

export function UserSocialStats({
  profile,
  className = "",
}: UserSocialStatsProps) {
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);

  return (
    <div className={`flex items-center gap-6 ${className}`}>
      <Button
        variant="ghost"
        className="flex flex-col items-center gap-1 h-auto p-2"
        onClick={() => setFollowersModalOpen(true)}
      >
        <span className="font-semibold text-lg">
          {profile.followers_count || 0}
        </span>
        <span className="text-sm text-muted-foreground">Followers</span>
      </Button>

      <Button
        variant="ghost"
        className="flex flex-col items-center gap-1 h-auto p-2"
        onClick={() => setFollowingModalOpen(true)}
      >
        <span className="font-semibold text-lg">
          {profile.following_count || 0}
        </span>
        <span className="text-sm text-muted-foreground">Following</span>
      </Button>

      {/* Modals */}
      <FollowersModal
        userId={profile.id}
        type="followers"
        isOpen={followersModalOpen}
        onClose={() => setFollowersModalOpen(false)}
      />

      <FollowersModal
        userId={profile.id}
        type="following"
        isOpen={followingModalOpen}
        onClose={() => setFollowingModalOpen(false)}
      />
    </div>
  );
}
