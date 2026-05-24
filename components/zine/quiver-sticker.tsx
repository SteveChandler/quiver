import Image from "next/image";
import type { CSSProperties } from "react";

import {
  getQuiverStickerAsset,
  type QuiverStickerKey,
} from "@/lib/ui/quiver-sticker-assets";
import { cn } from "@/lib/utils";

export interface QuiverStickerProps {
  sticker: QuiverStickerKey;
  className?: string;
  alt?: string;
  decorative?: boolean;
  priority?: boolean;
  sizes?: string;
  style?: CSSProperties;
}

export function QuiverSticker({
  sticker,
  className,
  alt,
  decorative = true,
  priority = false,
  sizes,
  style,
}: QuiverStickerProps) {
  const asset = getQuiverStickerAsset(sticker);

  return (
    <Image
      src={asset.src}
      alt={decorative ? "" : alt ?? asset.alt}
      width={asset.width}
      height={asset.height}
      priority={priority}
      sizes={sizes}
      aria-hidden={decorative || undefined}
      data-zine-sticker={asset.slug}
      className={cn("select-none", decorative && "pointer-events-none", className)}
      style={style}
    />
  );
}
