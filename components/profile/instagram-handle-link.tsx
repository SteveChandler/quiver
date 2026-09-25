import { Instagram } from "lucide-react";
import { instagramProfileUrl, normalizeInstagramHandle } from "@/lib/profile/instagram";
import { cn } from "@/lib/utils";

interface InstagramHandleLinkProps {
  handle: string | null | undefined;
  className?: string;
  iconClassName?: string;
}

export function InstagramHandleLink({
  handle,
  className,
  iconClassName,
}: InstagramHandleLinkProps) {
  const normalized = normalizeInstagramHandle(handle);
  if (!normalized) return null;

  return (
    <a
      href={instagramProfileUrl(normalized)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`@${normalized} on Instagram (opens in a new tab)`}
      className={cn("inline-flex items-center hover:underline underline-offset-2", className)}
    >
      <Instagram className={cn("mr-1", iconClassName)} aria-hidden="true" />
      <span>@{normalized}</span>
    </a>
  );
}
