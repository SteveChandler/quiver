"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ThumbsUp } from "lucide-react";
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
  const router = useRouter();
  const [localCount, setLocalCount] = useState(voteCount);
  const [localVoted, setLocalVoted] = useState(viewerHasVoted);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (!authed) {
      if (onSignInRequired) {
        onSignInRequired();
      } else {
        router.push(`/auth/sign-in?next=/roadmap%23item-${itemId}`);
      }
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

  // Anon variant — sign-in CTA. Lock + label, count still visible. No
  // aria-pressed (this is a navigation, not a toggle).
  if (!authed) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Sign in to vote — ${localCount} ${localCount === 1 ? "vote" : "votes"}`}
        className={cn(
          "group inline-flex items-center gap-2 rounded-[12px_3px_14px_3px] border px-3 py-1 transition",
          "border-[#2D357D]/60 bg-[#1E2558]/60 text-white/70",
          "hover:-rotate-[0.5deg] hover:border-[#F78E42]/60 hover:bg-[#252D6B] hover:text-[#F78E42]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]",
        )}
      >
        <Lock
          size={12}
          aria-hidden="true"
          className="text-white/50 transition group-hover:text-[#F78E42]"
        />
        <span className="font-[var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.15em]">
          Sign in to vote
        </span>
        <span
          aria-hidden="true"
          className="ml-1 border-l border-[#2D357D]/60 pl-2 font-[var(--font-mono)] text-sm font-bold tabular-nums text-white/80 group-hover:border-[#F78E42]/40"
        >
          {localCount}
        </span>
      </button>
    );
  }

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
