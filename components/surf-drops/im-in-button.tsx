"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import { useJoinSurfDrop } from "@/hooks/use-join-surf-drop";
import { useLeaveSurfDrop } from "@/hooks/use-leave-surf-drop";
import { useSoundCue } from "@/hooks/use-sound-cue";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useTrackEvent } from "@/hooks/use-track-event";
import { SonarPing } from "@/components/surf-drops/sonar-ping";
import { cn } from "@/lib/utils";

interface ImInButtonProps {
  dropId: string;
  shareSlug?: string;
  isJoined: boolean;
  participantsCount: number;
  onChange: (next: { isJoined: boolean; participantsCount: number }) => void;
  disabled?: boolean;
}

/**
 * Primary CTA on /drops/[id]. Optimistically toggles is_joined, plays a
 * subtle sonar+thump cue, and stamps a rotated overlay on join.
 */
export function ImInButton({
  dropId,
  shareSlug,
  isJoined,
  participantsCount,
  onChange,
  disabled,
}: ImInButtonProps) {
  const { join, loading: joining } = useJoinSurfDrop();
  const { leave, loading: leaving } = useLeaveSurfDrop();
  const { play } = useSoundCue();
  const reducedMotion = useReducedMotion();
  const { track } = useTrackEvent();
  const [showStamp, setShowStamp] = useState(false);

  const busy = joining || leaving || disabled;

  const handleClick = useCallback(async () => {
    if (busy) return;

    if (isJoined) {
      const prev = { isJoined, participantsCount };
      onChange({
        isJoined: false,
        participantsCount: Math.max(0, participantsCount - 1),
      });
      try {
        await leave(dropId);
        void track("surf_drop_left", {
          metadata: { drop_id: dropId },
        });
      } catch {
        onChange(prev);
      }
      return;
    }

    const prev = { isJoined, participantsCount };
    onChange({ isJoined: true, participantsCount: participantsCount + 1 });
    play("im-in-thump");
    setShowStamp(true);
    window.setTimeout(() => setShowStamp(false), 1400);
    try {
      const result = await join(dropId, { shareSlug });
      onChange({
        isJoined: true,
        participantsCount: result.participants_count,
      });
      void track("surf_drop_joined", {
        metadata: { drop_id: dropId, via_share_slug: Boolean(shareSlug) },
      });
    } catch {
      onChange(prev);
      setShowStamp(false);
    }
  }, [
    busy,
    dropId,
    isJoined,
    join,
    leave,
    onChange,
    participantsCount,
    play,
    shareSlug,
    track,
  ]);

  return (
    <div className="im-in-button__wrap">
      {!isJoined && !reducedMotion ? (
        <div className="im-in-button__sonar" aria-hidden>
          <SonarPing size={200} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-pressed={isJoined}
        className={cn(
          "im-in-button",
          isJoined && "im-in-button--joined",
          busy && "im-in-button--busy",
        )}
        data-testid="im-in-button"
      >
        <span className="im-in-button__label">
          {isJoined ? "You're in — tap to leave" : "I'm in"}
        </span>
      </button>

      <AnimatePresence>
        {showStamp ? (
          <motion.div
            key="im-in-stamp"
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { scale: 0.4, rotate: -18, opacity: 0 }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : { scale: 1, rotate: -6, opacity: 1 }
            }
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.32 }}
            className="im-in-button__stamp"
            aria-hidden
          >
            IN
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
