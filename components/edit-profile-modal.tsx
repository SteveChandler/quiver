"use client";

import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { EditProfileForm } from "./edit-profile-form";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  onProfileUpdated: () => void;
  scrollToNotifications?: boolean;
}

export function EditProfileModal({
  open,
  onOpenChange,
  profile,
  onProfileUpdated,
  scrollToNotifications,
}: EditProfileModalProps) {
  const typedProfile = profile as Profile & { notif_session_prompt_email?: boolean | null };
  const initialData = profile
    ? {
        full_name: typedProfile.full_name ?? undefined,
        bio: typedProfile.bio ?? undefined,
        location: typedProfile.location ?? undefined,
        experience_level: typedProfile.experience_level ?? undefined,
        instagram: typedProfile.instagram ?? undefined,
        avatar_url: typedProfile.avatar_url ?? undefined,
        home_beach_id: typedProfile.home_beach_id ?? undefined,
        surf_styles: typedProfile.surf_styles ?? undefined,
        notif_push_enabled: typedProfile.notif_push_enabled,
        notif_email_enabled: typedProfile.notif_email_enabled,
        notif_inapp_enabled: typedProfile.notif_inapp_enabled,
        notif_likes: typedProfile.notif_likes,
        notif_follows: typedProfile.notif_follows,
        notif_reminders: typedProfile.notif_reminders,
        notif_xp_updates: typedProfile.notif_xp_updates,
        notif_session_prompt_email: typedProfile.notif_session_prompt_email ?? true,
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your profile information</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-2" id="edit-profile-modal-content">
          <EditProfileForm
            initialData={initialData}
            onSuccess={onProfileUpdated}
            scrollToNotifications={scrollToNotifications}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
