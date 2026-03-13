"use client";

import { ShareSheet } from "@/components/share/share-sheet";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralCode: string | null;
}

/**
 * Invite-a-Friend share sheet.
 * Wraps the generic ShareSheet with invite-specific copy and a referral link.
 * Falls back gracefully when the referral code is still loading.
 */
export function InviteSheet({ open, onOpenChange, referralCode }: InviteSheetProps) {
  const shareUrl = referralCode
    ? `${SITE_URL}/?ref=${referralCode}`
    : SITE_URL;

  return (
    <ShareSheet
      open={open}
      onOpenChange={onOpenChange}
      imageUrl="/api/og/surf-call?beach=Quiver&message=Join+the+crew&conditionLabel=Invite"
      type="wave"
      title="Join me on Quiver"
      text="I'm using Quiver to find the best surf conditions. Join with my invite link!"
      shareUrl={shareUrl}
      filename="quiver-invite"
    />
  );
}
