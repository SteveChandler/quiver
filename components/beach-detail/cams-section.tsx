"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Camera } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface CamsSectionProps {
  beachId: string;
}

export function CamsSection({ beachId }: CamsSectionProps) {
  const fetchSources = useCallback(async () => {
    const res = await fetch(`/api/beaches/${beachId}/sources`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Failed to fetch beach sources: ${res.status}`);
    }
    const json = await res.json();
    return json?.data?.sources || json?.sources || null;
  }, [beachId]);

  const { data: sources, loading, error, refetch } = useDataFetcher(fetchSources, { immediate: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" /> Live Cams
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading cams...
          </div>
        )}

        {!loading && !sources?.camera_url && (
          <div className="text-sm text-muted-foreground">
            No camera link available for this beach.
          </div>
        )}

        {sources?.camera_url && (
          <div className="flex items-center justify-between">
            <a
              href={sources.camera_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Open live cam
            </a>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600">{String(error)}</div>
        )}
      </CardContent>
    </Card>
  );
}


