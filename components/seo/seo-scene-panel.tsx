import Image from "next/image";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";
import type { SeoScene } from "@/lib/constants/seo-scenes";

interface SeoScenePanelProps {
  scene: SeoScene;
  priority?: boolean;
  className?: string;
  mediaClassName?: string;
}

export function SeoScenePanel({
  scene,
  priority = false,
  className,
  mediaClassName,
}: SeoScenePanelProps): ReactElement {
  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-lg border border-[#252D6B]/15 bg-[#182445] shadow-[0_18px_42px_rgba(37,45,107,0.16)]",
        className
      )}
    >
      <div className={cn("relative aspect-[16/9] min-h-[260px]", mediaClassName)}>
        <Image
          src={scene.imageSrc}
          alt={scene.alt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 42vw"
          className="object-cover"
          style={{ objectPosition: scene.objectPosition ?? "center" }}
        />
      </div>
    </figure>
  );
}
