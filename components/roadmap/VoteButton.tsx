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
        aria-label={`Sign in to vote, ${localCount} ${localCount === 1 ? "vote" : "votes"}`}
        className={cn(
          "group inline-flex items-center gap-2 rounded-[12px_3px_14px_3px] border-2 px-3 py-1 transition",
          "border-[#11100D]/45 bg-[#F0E5CC] text-[#11100D]/70 shadow-[1px_2px_0_rgba(17,16,13,0.12)]",
          "hover:-rotate-[0.5deg] hover:border-[#F78E42] hover:text-[#11100D]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]",
        )}
      >
        <Lock
          size={12}
          aria-hidden="true"
          className="text-[#11100D]/45 transition group-hover:text-[#B56A2B]"
        />
        <span className="font-[var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.15em]">
          Sign in to vote
        </span>
        <span
          aria-hidden="true"
          className="ml-1 border-l border-[#11100D]/25 pl-2 font-[var(--font-mono)] text-sm font-bold tabular-nums text-[#11100D] group-hover:border-[#F78E42]/60"
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
        "inline-flex items-center gap-1.5 rounded-[12px_3px_14px_3px] border-2 px-3 py-1 transition disabled:cursor-not-allowed",
        localVoted
          ? "border-[#11100D] bg-[#F78E42] text-[#11100D] shadow-[1px_2px_0_rgba(17,16,13,0.2)]"
          : "border-[#11100D]/45 bg-[#F0E5CC] text-[#11100D]/70 hover:border-[#F78E42] hover:text-[#11100D]",
      ) + " focus-ring"}
    >
      <ThumbsUp size={14} aria-hidden="true" />
      <span className="font-[var(--font-mono)] text-sm font-bold">{localCount}</span>
    </button>
  );
}
