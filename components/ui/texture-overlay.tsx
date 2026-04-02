import { cn } from "@/lib/utils";

type TextureVariant = "wave" | "topo" | "topo-static";

interface TextureOverlayProps {
  variant: TextureVariant;
  className?: string;
}

const VARIANT_CLASS: Record<TextureVariant, string> = {
  wave: "tex-waves",
  topo: "tex-topo",
  "topo-static": "tex-topo-static",
};

export function TextureOverlay({ variant, className }: TextureOverlayProps) {
  return (
    <div
      className={cn(VARIANT_CLASS[variant], className)}
      aria-hidden="true"
    />
  );
}
