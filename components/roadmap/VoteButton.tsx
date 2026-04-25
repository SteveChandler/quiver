"use client";
import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  itemId: string;
  voteCount: number;
  viewerHasVoted: boolean;
  authed: boolean;
  onSignInRequired?: () => void;
}

export function VoteButton({
  itemId,
  voteCount,
  viewerHasVoted,
  authed,
  onSignInRequired,
}: Props) {
  const [localCount, setLocalCount] = useState(voteCount);
  const [localVoted, setLocalVoted] = useState(viewerHasVoted);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (!authed) {
      onSignInRequired?.();
      return;
    }
    if (pending) return;

    const prevVoted = localVoted;
    const prevCount = localCount;
    const nextVoted = !prevVoted;

    // Optimistic update
    setLocalVoted(nextVoted);
    setLocalCount(prevCount + (nextVoted ? 1 : -1));
    setPending(true);

    try {
      const res = await fetch(`/api/roadmap/items/${itemId}/vote`, { method: "POST" });
      if (!res.ok) throw new Error("Vote failed");
    } catch {
      // Roll back optimistic update
      setLocalVoted(prevVoted);
      setLocalCount(prevCount);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={localVoted}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[12px_3px_14px_3px] border px-3 py-1 transition disabled:cursor-not-allowed",
        localVoted
          ? "border-[#F78E42] bg-[#F78E42]/10 text-[#F78E42]"
          : "border-[#2D357D]/60 bg-[#1E2558]/60 text-white/70 hover:border-[#F78E42]/60 hover:text-[#F78E42]",
      )}
    >
      <ThumbsUp size={14} aria-hidden="true" />
      <span className="font-[var(--font-mono)] text-sm font-bold">{localCount}</span>
    </button>
  );
}
