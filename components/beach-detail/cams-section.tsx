"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CameraOff, PlayCircle, RefreshCw } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { buildCamEmbed } from "@/lib/media/cam-embed";

interface CamsSectionProps {
  beachId: string;
}

export function CamsSection({ beachId }: CamsSectionProps) {
  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`/api/beaches/${beachId}/sources`);
      if (!res.ok) {
        return null;
      }
      const json = await res.json().catch(() => ({} as any));
      return (json as any)?.data?.sources || (json as any)?.sources || null;
    } catch {
      return null;
    }
  }, [beachId]);

  const {
    data: sources,
    loading,
    refetch,
  } = useDataFetcher(fetchSources, { immediate: true });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  useEffect(() => {
    setIframeBlocked(false);
  }, [sources?.camera_url]);

  const cameraUrl = sources?.camera_url as string | undefined;
  const intent = cameraUrl ? buildCamEmbed(cameraUrl) : null;
  const allowIframe =
    intent &&
    intent.kind === "iframe" &&
    iframeBlocked === false &&
    (sources as any)?.embed_allowed !== false;

  let visual: React.ReactNode;

  if (loading) {
    visual = (
      <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100/70 via-white to-blue-50 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-ocean-blue" />
        <span className="text-sm">Fetching live feed…</span>
      </div>
    );
  } else if (!cameraUrl) {
    visual = (
      <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100/80 via-white to-blue-50 text-center">
        <CameraOff className="h-10 w-10 text-ocean-blue" />
        <div className="max-w-sm text-sm text-muted-foreground">
          No live cam available yet. Know a good angle? Let the crew know.
        </div>
        <Button
          asChild
          size="sm"
          className="bg-ocean-blue text-white hover:bg-ocean-blue/90"
        >
          <a
            href="mailto:support@quiversurf.app?subject=Cam%20suggestion"
            rel="noopener noreferrer"
          >
            Suggest a cam
          </a>
        </Button>
      </div>
    );
  } else if (allowIframe && intent) {
    visual = (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <iframe
          ref={iframeRef}
          src={intent.src}
          title={intent.title || "Live Cam"}
          allow={intent.allow}
          className="h-full w-full"
          loading="lazy"
          onError={() => setIframeBlocked(true)}
        />
      </div>
    );
  } else if (intent?.kind === "video") {
    visual = (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <video
          src={intent.src}
          controls
          autoPlay
          playsInline
          muted
          className="h-full w-full"
        />
      </div>
    );
  } else {
    visual = (
      <div className="relative flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 text-white">
        <PlayCircle className="h-12 w-12 text-white/80" />
        <div className="text-sm text-white/80">
          Preview unavailable. Pop open the cam instead.
        </div>
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="bg-white/20 hover:bg-white/30"
        >
          <a href={cameraUrl} target="_blank" rel="noopener noreferrer">
            Open camera
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg">
      {visual}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100/60 bg-blue-50/70 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Refresh for the latest frame or open the feed in a new tab.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-ocean-blue hover:bg-ocean-blue/10"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {cameraUrl ? (
            <Button
              asChild
              size="sm"
              className="bg-ocean-blue text-white hover:bg-ocean-blue/90"
            >
              <a href={cameraUrl} target="_blank" rel="noopener noreferrer">
                Open cam
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
