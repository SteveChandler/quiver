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
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition disabled:cursor-not-allowed",
        localVoted
          ? "border-orange-500 bg-orange-500/10 text-orange-400"
          : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600",
      )}
    >
      <ThumbsUp size={14} aria-hidden="true" />
      <span>{localCount}</span>
    </button>
  );
}
