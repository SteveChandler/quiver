"use client";

import { useState, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/hooks/useProfile";
import { setHomeBeach } from "@/actions/profile-actions";

interface HomeBeachBannerProps {
  selectedBeachId: string;
}

export function HomeBeachBanner({ selectedBeachId }: HomeBeachBannerProps) {
  const { profile, mutate } = useProfile();
  const [saving, setSaving] = useState(false);

  async function onSet() {
    setSaving(true);
    try {
      await setHomeBeach(selectedBeachId);
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