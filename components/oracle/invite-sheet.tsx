"use client";

import { ShareSheet } from "@/components/share/share-sheet";

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
    ? `https://quiversurf.app/?ref=${referralCode}`
    : "https://quiversurf.app";

  return (
    <ShareSheet
      open={open}
      onOpenChange={onOpenChange}
      imageUrl="/api/og/surf-call?beach=Quiver&verdict=YES&window=Join+the+crew&waveHeight=%F0%9F%A4%99&wind=Share+the+stoke"
      type="wave"
      title="Join me on Quiver"
      text="I'm using Quiver to find the best surf conditions. Join with my invite link!"
      shareUrl={shareUrl}
      filename="quiver-invite"
    />
  );
}
