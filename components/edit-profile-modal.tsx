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
  const initialData = profile
    ? {
        full_name: profile.full_name ?? undefined,
        bio: profile.bio ?? undefined,
        location: profile.location ?? undefined,
        experience_level: profile.experience_level ?? undefined,
        instagram: profile.instagram ?? undefined,
        avatar_url: profile.avatar_url ?? undefined,
        home_beach_id: profile.home_beach_id ?? undefined,
        surf_styles: profile.surf_styles ?? undefined,
        notif_push_enabled: profile.notif_push_enabled,
        notif_email_enabled: profile.notif_email_enabled,
        notif_inapp_enabled: profile.notif_inapp_enabled,
        notif_likes: profile.notif_likes,
        notif_follows: profile.notif_follows,
        notif_reminders: profile.notif_reminders,
        notif_xp_updates: profile.notif_xp_updates,
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
