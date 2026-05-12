"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  CameraOff,
  ExternalLink,
  Loader2,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { buildCamEmbed, getViewableUrl, toProxiedHlsUrl } from "@/lib/media/cam-embed";
import {
  getCamThumbnailUrl,
  getYouTubeWatchUrl,
  isYouTubeCameraUrl,
} from "@/lib/media/cam-thumbnail";
import type { BeachSources } from "@/hooks/use-beach-detail-data";

const HLSVideoPlayer = dynamic(() => import("./hls-video-player"), {
  ssr: false,
});

interface CamsSectionProps {
  sources?: BeachSources | null;
  variant?: "default" | "hero";
  /** Beach name used for accessible video labels, e.g. "Live cam of Malibu Surfrider" */
  beachName?: string;
}

export function CamsSection({
  sources,
  variant = "default",
  beachName,
}: CamsSectionProps) {
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
  const youtubeThumbnailUrl = useMemo(() => getCamThumbnailUrl(cameraUrl), [cameraUrl]);
  const youtubeClickoutUrl = useMemo(() => {
    if (!isYouTubeCameraUrl(cameraUrl)) return null;
    return getYouTubeWatchUrl(cameraUrl) ?? viewableUrl;
  }, [cameraUrl, viewableUrl]);
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

  const dioramaUrl = sources?.diorama_url ?? undefined;

  const dioramaVisual = dioramaUrl ? (
    <div className="relative aspect-video w-full overflow-hidden bg-[#252D6B]">
      {/* Diorama is a decorative AI-generated loop — no informational content */}
      <video
        src={dioramaUrl}
        autoPlay
        loop
        playsInline
        muted
        role="presentation"
        aria-hidden="true"
        className="h-full w-full object-cover"
      />
    </div>
  ) : null;

  const noCamVisual = (
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

  const streamUnavailableVisual = (
    <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100/70 via-white to-blue-50 text-center">
      <CameraOff className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Live stream unavailable right now</p>
    </div>
  );

  let visual: React.ReactNode;
  // Shared accessible label used across iframe / hdontap / hls / video branches
  // so screen readers hear the spot name instead of a generic "Live Cam" for
  // every beach.
  const camLabel = beachName ? `Live cam of ${beachName}` : "Live Cam";

  if (youtubeClickoutUrl) {
    visual = (
      <YouTubeCamClickout
        href={youtubeClickoutUrl}
        thumbnailUrl={youtubeThumbnailUrl}
        camLabel={camLabel}
      />
    );
  } else if (allowIframe && intent) {
    visual = (
      <div key={playerKey} className="relative aspect-video w-full overflow-hidden bg-black">
        <iframe
          ref={iframeRef}
          src={intent.src}
          title={intent.title || camLabel}
          allow={intent.allow}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setIframeBlocked(true)}
        />
      </div>
    );
  } else if (intent?.kind === "hdontap") {
    visual = hlsError ? (
      dioramaVisual ?? streamUnavailableVisual
    ) : resolvedHlsUrl ? (
      <HLSVideoPlayer key={playerKey} src={resolvedHlsUrl} title={camLabel} onError={() => setHlsError(true)} />
    ) : (
      <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100/70 via-white to-blue-50 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-ocean-blue" />
        <span className="text-sm">Connecting to live cam…</span>
      </div>
    );
  } else if (intent?.kind === "hls") {
    visual = hlsError
      ? (dioramaVisual ?? streamUnavailableVisual)
      : <HLSVideoPlayer key={playerKey} src={intent.src} title={camLabel} onError={() => setHlsError(true)} />;
  } else if (intent?.kind === "video") {
    visual = (
      <div key={playerKey} className="relative aspect-video w-full overflow-hidden bg-black">
        <video
          src={intent.src}
          controls
          autoPlay
          playsInline
          muted
          aria-label={camLabel}
          className="h-full w-full object-cover"
        />
      </div>
    );
  } else if (dioramaVisual) {
    // No embeddable camera (either no camera_url, or intent.kind === "none") — fall back to diorama
    visual = dioramaVisual;
  } else if (!cameraUrl) {
    visual = noCamVisual;
  } else {
    // Camera exists but can't be embedded and no diorama fallback — hide section entirely
    return null;
  }

  if (variant === "hero") {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-video [&>div]:h-full [&>div]:!aspect-auto">
        {visual}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg">
      {visual}
      {!youtubeClickoutUrl && (
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
      )}
    </div>
  );
}

function YouTubeCamClickout({
  href,
  thumbnailUrl,
  camLabel,
}: {
  href: string;
  thumbnailUrl: string | null;
  camLabel: string;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[#11100D]">
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl}
          alt=""
          width={640}
          height={360}
          sizes="(min-width: 768px) 40vw, 100vw"
          className="h-full w-full object-cover opacity-70 saturate-[0.9]"
        />
      ) : null}
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
        <PlayCircle className="h-12 w-12 text-white drop-shadow" aria-hidden />
        <Button
          asChild
          size="sm"
          className="bg-[#F78E42] text-[#11100D] shadow-[3px_4px_0_rgba(0,0,0,0.35)] hover:bg-[#F78E42]/90"
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${camLabel}: open live cam on YouTube`}
          >
            Open live cam on YouTube
            <ExternalLink className="ml-1 h-4 w-4" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}
