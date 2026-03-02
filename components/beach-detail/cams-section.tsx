"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Loader2, CameraOff, RefreshCw } from "lucide-react";
import { buildCamEmbed, getViewableUrl, toProxiedHlsUrl } from "@/lib/media/cam-embed";
import type { BeachSources } from "@/hooks/use-beach-detail-data";

const HLSVideoPlayer = dynamic(() => import("./hls-video-player"), {
  ssr: false,
});

interface CamsSectionProps {
  sources?: BeachSources | null;
  variant?: "default" | "hero";
}

export function CamsSection({ sources, variant = "default" }: CamsSectionProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [hlsError, setHlsError] = useState(false);
  const [resolvedHlsUrl, setResolvedHlsUrl] = useState<string | null>(null);
  // Counter to re-mount the player on Refresh
  const [playerKey, setPlayerKey] = useState(0);

  const cameraUrl = sources?.camera_url ?? undefined;

  useEffect(() => {
    setIframeBlocked(false);
    setHlsError(false);
    setResolvedHlsUrl(null);
  }, [cameraUrl]);

  const intent = cameraUrl ? buildCamEmbed(cameraUrl) : null;
  const viewableUrl = useMemo(() => getViewableUrl(cameraUrl), [cameraUrl]);
  const allowIframe =
    intent &&
    intent.kind === "iframe" &&
    iframeBlocked === false &&
    sources?.embed_allowed !== false;

  // Resolve HDOnTap page URLs -> HLS stream URLs server-side
  const hdontapPageUrl = intent?.kind === "hdontap" ? intent.pageUrl : null;
  useEffect(() => {
    if (!hdontapPageUrl) return;
    let cancelled = false;
    setResolvedHlsUrl(null);
    setHlsError(false);
    fetch(`/api/cam-resolve?url=${encodeURIComponent(hdontapPageUrl)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { hlsUrl?: string }) => {
        if (!cancelled && data.hlsUrl) {
          setResolvedHlsUrl(toProxiedHlsUrl(data.hlsUrl));
        } else if (!cancelled) {
          setHlsError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHlsError(true);
      });
    return () => { cancelled = true; };
  }, [hdontapPageUrl, playerKey]);

  const handleRefresh = () => {
    setHlsError(false);
    setResolvedHlsUrl(null);
    setIframeBlocked(false);
    setPlayerKey((k) => k + 1);
  };

  let visual: React.ReactNode;

  if (!cameraUrl) {
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
      <div key={playerKey} className="relative aspect-video w-full overflow-hidden bg-black">
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
  } else if (intent?.kind === "hdontap") {
    visual = hlsError ? (
      <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100/70 via-white to-blue-50 text-center">
        <CameraOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Live stream unavailable right now</p>
      </div>
    ) : resolvedHlsUrl ? (
      <HLSVideoPlayer key={playerKey} src={resolvedHlsUrl} title="Live Cam" onError={() => setHlsError(true)} />
    ) : (
      <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100/70 via-white to-blue-50 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-ocean-blue" />
        <span className="text-sm">Connecting to live cam…</span>
      </div>
    );
  } else if (intent?.kind === "hls") {
    visual = hlsError ? (
      <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100/70 via-white to-blue-50 text-center">
        <CameraOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Live stream unavailable right now</p>
      </div>
    ) : (
      <HLSVideoPlayer key={playerKey} src={intent.src} title="Live Cam" onError={() => setHlsError(true)} />
    );
  } else if (intent?.kind === "video") {
    visual = (
      <div key={playerKey} className="relative aspect-video w-full overflow-hidden bg-black">
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
    // Camera exists but can't be embedded — hide section entirely
    return null;
  }

  if (variant === "hero") {
    return (
      <div className="relative aspect-video w-full overflow-hidden">
        {visual}
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
            onClick={handleRefresh}
            className="text-ocean-blue hover:bg-ocean-blue/10"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {viewableUrl ? (
            <Button
              asChild
              size="sm"
              className="bg-ocean-blue text-white hover:bg-ocean-blue/90"
            >
              <a href={viewableUrl} target="_blank" rel="noopener noreferrer">
                Open cam
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
