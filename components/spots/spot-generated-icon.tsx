import Image from "next/image";

const ICON_PATHS = {
  "best-season": "/images/spot-icons/best-season.png",
  gallery: "/images/spot-icons/gallery.png",
  "launch-arrow": "/images/spot-icons/launch-arrow.png",
  location: "/images/spot-icons/location.png",
  photo: "/images/spot-icons/photo.png",
  "session-profile": "/images/spot-icons/session-profile.png",
  "swell-match": "/images/spot-icons/swell-match.png",
  "tide-window": "/images/spot-icons/tide-window.png",
  "water-temp": "/images/spot-icons/water-temp.png",
  "wind-read": "/images/spot-icons/wind-read.png",
} as const;

export type SpotGeneratedIconName = keyof typeof ICON_PATHS;

interface SpotGeneratedIconProps {
  name: SpotGeneratedIconName;
  size?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
}

export function SpotGeneratedIcon({
  name,
  size = 40,
  alt = "",
  className,
  priority = false,
}: SpotGeneratedIconProps) {
  return (
    <Image
      src={ICON_PATHS[name]}
      alt={alt}
      width={size}
      height={size}
      priority={priority || undefined}
      className={className}
      unoptimized
    />
  );
}
