"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";

interface HLSVideoPlayerProps {
  src: string;
  title?: string;
  onError?: () => void;
}

export default function HLSVideoPlayer({ src, title, onError }: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Propagate error to parent (stable ref avoids re-render loops)
  useEffect(() => {
    if (error) onErrorRef.current?.();
  }, [error]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(false);
    setIsLoading(true);

    // Prefer hls.js (more reliable with proxied streams), fall back to
    // native HLS only on platforms where MediaSource isn't available (iOS Safari).
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !video) return;

      if (Hls.isSupported()) {
        let networkRetries = 0;
        const MAX_RETRIES = 3;

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            if (
              data.type === Hls.ErrorTypes.NETWORK_ERROR &&
              networkRetries < MAX_RETRIES
            ) {
              networkRetries++;
              hls.startLoad();
            } else {
              setError(true);
              setIsLoading(false);
              hls.destroy();
              hlsRef.current = null;
            }
          }
        });

        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;

        video.addEventListener("loadeddata", () => {
          if (!cancelled) setIsLoading(false);
        }, { once: true });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // iOS Safari: native HLS fallback
        video.src = src;
        video.addEventListener("error", () => { setError(true); setIsLoading(false); }, { once: true });
        video.addEventListener("loadeddata", () => { if (!cancelled) setIsLoading(false); }, { once: true });
      } else {
        setError(true);
        setIsLoading(false);
      }
    }).catch(() => {
      // hls.js failed to load — try native as last resort
      if (!cancelled && video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener("error", () => { setError(true); setIsLoading(false); }, { once: true });
        video.addEventListener("loadeddata", () => { if (!cancelled) setIsLoading(false); }, { once: true });
      } else if (!cancelled) {
        setError(true);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100/70 via-white to-blue-50 text-center">
        <CameraOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Live stream unavailable right now</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        muted
        className="h-full w-full"
        title={title}
      />
    </div>
  );
}
