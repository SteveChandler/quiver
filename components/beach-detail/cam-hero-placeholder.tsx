"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { getCamThumbnailUrl } from "@/lib/media/cam-thumbnail";

interface CamHeroPlaceholderProps {
  cameraUrl?: string | null;
  beachName: string;
}

export function CamHeroPlaceholder({
  cameraUrl,
  beachName,
}: CamHeroPlaceholderProps) {
  const thumbnailUrl = getCamThumbnailUrl(cameraUrl);
  const [imgError, setImgError] = useState(false);
  const showThumbnail = thumbnailUrl && !imgError;

  if (showThumbnail) {
    return (
      <div className="relative aspect-video w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt={`${beachName} live camera preview`}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600">
      <Camera className="h-16 w-16 text-white/30" />
    </div>
  );
}
