"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Camera } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { buildCamEmbed } from "@/lib/media/cam-embed";

interface CamsSectionProps {
  beachId: string;
}

export function CamsSection({ beachId }: CamsSectionProps) {
  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`/api/beaches/${beachId}/sources`, {
        cache: "no-store",
      });
      if (!res.ok) {
        // Soften failures: treat as no cam available
        return null;
      }
      const json = await res.json().catch(() => ({} as any));
      return (json as any)?.data?.sources || (json as any)?.sources || null;
    } catch {
      // Network or parsing error: gracefully fall back
      return null;
    }
  }, [beachId]);

  const {
    data: sources,
    loading,
    error,
    refetch,
  } = useDataFetcher(fetchSources, { immediate: true });

  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    setIframeBlocked(false);
    setIframeLoaded(false);
    if (!sources?.camera_url) return;
    const timeout = setTimeout(() => {
      if (!iframeLoaded) {
        setIframeBlocked(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [sources?.camera_url, iframeLoaded]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" /> Live Cam
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
          <div className="space-y-3">
            {(() => {
              const intent = buildCamEmbed(sources.camera_url as string);
              const allowIframe =
                (sources as any)?.embed_allowed !== false &&
                intent.kind === "iframe" &&
                !iframeBlocked;
              if (allowIframe) {
                return (
                  <div className="w-full aspect-video rounded-lg overflow-hidden border">
                    <iframe
                      ref={iframeRef}
                      src={intent.src}
                      title={intent.title || "Live Cam"}
                      allow={intent.allow}
                      className="w-full h-full"
                      loading="lazy"
                      onLoad={() => setIframeLoaded(true)}
                      onError={() => setIframeBlocked(true)}
                    />
                  </div>
                );
              }
              if (intent.kind === "video") {
                return (
                  <div className="w-full aspect-video rounded-lg overflow-hidden border">
                    <video
                      src={intent.src}
                      controls
                      playsInline
                      className="w-full h-full"
                    />
                  </div>
                );
              }
              // HLS or blocked iframe → fallback
              return (
                <div className="w-full aspect-video rounded-lg overflow-hidden flex items-center justify-center bg-muted">
                  <div className="text-center space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Preview unavailable
                    </div>
                    <a
                      href={sources.camera_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary underline"
                    >
                      Open camera
                    </a>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Refresh
              </Button>
              <a
                href={sources.camera_url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
              >
                Open camera
              </a>
            </div>
          </div>
        )}

        {/* Errors are softened to a neutral empty state; no explicit error UI */}
      </CardContent>
    </Card>
  );
}
