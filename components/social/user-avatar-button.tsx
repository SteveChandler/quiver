"use client";

import { useCallback, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { UserProfileModal } from "@/components/social/user-profile-modal";

interface UserAvatarButtonProps {
  userId: string;
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  stopPropagation?: boolean;
}

export function UserAvatarButton({
  userId,
  src,
  name,
  email,
  size = "sm",
  className,
  stopPropagation = true,
}: UserAvatarButtonProps) {
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (stopPropagation) {
        e.preventDefault();
        e.stopPropagation();
      }
      setOpen(true);
    },
    [stopPropagation]
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={"hover:opacity-80 transition-opacity " + (className || "") + " focus-ring"}
        aria-label={name ? `${name}'s profile` : "View profile"}
      >
        <UserAvatar
          src={src || undefined}
          name={name || undefined}
          email={email || undefined}
          size={size}
        />
      </button>
      <UserProfileModal
        userId={userId}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
