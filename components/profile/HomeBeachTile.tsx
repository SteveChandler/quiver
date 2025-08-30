"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";

interface HomeBeachTileProps {
  beachLookup?: Record<string, string>;
}

export function HomeBeachTile({ beachLookup = {} }: HomeBeachTileProps) {
  const { profile, loading } = useProfile();
  
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Home Break</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold animate-pulse bg-gray-200 h-8 rounded"></div>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const homeName = profile?.default_beach_id 
    ? beachLookup[profile.default_beach_id] || "—"
    : "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Home Break</CardTitle>
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold truncate" data-testid="home-break-value">
          {homeName}
        </div>
        <p className="text-xs text-muted-foreground">
          {profile?.default_beach_id ? "From profile" : "Not set"}
        </p>
      </CardContent>
    </Card>
  );
}