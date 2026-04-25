"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  inviterId: string;
  displayName: string;
}

/**
 * Client-side follow button for the invite landing card. Calls
 * POST /api/users/[id]/follow/toggle and navigates to the inviter's
 * profile on success.
 */
export function FollowButton({ inviterId, displayName }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${inviterId}/follow/toggle`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Follow failed (${response.status})`);
      }
      router.push(`/profile/${inviterId}?invited=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Following…" : `Follow ${displayName}`}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      ) : null}
    </>
  );
}
