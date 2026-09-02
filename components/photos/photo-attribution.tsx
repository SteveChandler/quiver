import type { ReactElement } from "react";
import Link from "next/link";

import { stripPublicDomainNotice } from "@/lib/photos/license-notice";

export interface StructuredPhotoAttribution {
  kind: "profile" | "community";
  displayName: string;
  profileId: string | null;
}

interface PhotoAttributionProps {
  attribution: StructuredPhotoAttribution | null;
  attributionHtml?: string | null;
  className?: string;
}

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&apos;": "'",
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
};

function legacyAttributionText(value: string | null | undefined): string {
  const withoutTags = value?.replace(/<[^>]*>/g, " ") ?? "";
  const decoded = withoutTags.replace(
    /&(amp|apos|#39|lt|gt|quot);/g,
    (entity) => HTML_ENTITIES[entity] ?? entity,
  );

  return stripPublicDomainNotice(decoded.replace(/\s+/g, " ").trim());
}

export function PhotoAttribution({
  attribution,
  attributionHtml,
  className,
}: PhotoAttributionProps): ReactElement | null {
  const displayName = attribution?.displayName.trim();

  if (
    attribution?.kind === "profile" &&
    attribution.profileId &&
    displayName
  ) {
    return (
      <Link href={`/profile/${attribution.profileId}`} className={className}>
        {displayName}
      </Link>
    );
  }

  if (displayName) {
    return <span className={className}>{displayName}</span>;
  }

  if (attribution) {
    return <span className={className}>Quiver community</span>;
  }

  const curatedText = legacyAttributionText(attributionHtml);
  if (!curatedText) return null;

  return <span className={className}>{curatedText}</span>;
}
