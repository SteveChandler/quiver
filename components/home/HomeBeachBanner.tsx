"use client";

import { useState, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/hooks/useProfile";
import { updateProfile } from "@/actions/profile-actions";

interface HomeBeachBannerProps {
  selectedBeachId: string;
  selectedBeachName?: string;
}

import { track, slugify } from "@/lib/analytics";

export function HomeBeachBanner({ selectedBeachId, selectedBeachName }: HomeBeachBannerProps) {
  const { profile, mutate } = useProfile();
  const [saving, setSaving] = useState(false);

  async function onSet() {
    setSaving(true);
    try {
      console.debug("[HomeBeach/UI] submit payload", {
        home_beach_id: selectedBeachId,
      });
      await updateProfile({ home_beach_id: selectedBeachId });
      // Analytics: set_home_beach (mark as conversion in GA UI)
      try {
        const slug = selectedBeachName ? slugify(selectedBeachName) : selectedBeachId;
        track("set_home_beach", { beach_slug: slug });
      } catch {}
      // optimistic refetch
      startTransition(() => mutate());
    } finally {
      setSaving(false);
    }
  }

  // Hide banner if already set to this beach
  if (profile?.home_beach_id === selectedBeachId) return null;

  return (
    <div data-testid="home-beach-banner">
      <Button
        data-testid="set-home-beach"
        disabled={saving}
        onClick={onSet}
        className="w-full"
      >
        {saving ? "Saving..." : "Set Home Beach"}
      </Button>
    </div>
  );
}
