"use client";

import { useEffect, useRef, useState } from "react";

interface HLSVideoPlayerProps {
  src: string;
  title?: string;
}

export default function HLSVideoPlayer({ src, title }: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(false);

    // Safari supports HLS natively
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("error", () => setError(true), { once: true });
      return () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    // Dynamic import hls.js for Chrome/Firefox (code-split)
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !video) return;

      if (!Hls.isSupported()) {
        setError(true);
        return;
      }

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
            hls.destroy();
            hlsRef.current = null;
          }
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
    });

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  if (error) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
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
