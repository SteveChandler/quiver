import Link from "next/link";
import { ZineSurface } from "@/components/zine";

interface UnavailableStateProps {
  status: "notfound" | "expired" | "cancelled";
  creatorName?: string | null;
  generalArea?: string | null;
}

const COPY: Record<
  UnavailableStateProps["status"],
  { title: string; body: string }
> = {
  notfound: {
    title: "This Surf Drop can't be found",
    body: "The link may have been mistyped, or the creator may have removed it.",
  },
  expired: {
    title: "This Surf Drop already happened",
    body: "The window closed. Ask them to drop another when the swell shows up.",
  },
  cancelled: {
    title: "This Surf Drop was cancelled",
    body: "Might not be their day. Catch you at the next one.",
  },
};

/**
 * Safe fallback surface. Never renders coordinates, spot names, or times.
 */
export function UnavailableState({
  status,
  creatorName,
  generalArea,
}: UnavailableStateProps) {
  const copy = COPY[status];
  const attribution = creatorName ? `${creatorName}` : "A surfer";
  const area = generalArea ? ` near ${generalArea}` : "";

  return (
    <ZineSurface sectionLabel="Surf Drop">
      <div className="surf-drop-unavailable">
        <p className="surf-drop-unavailable__eyebrow">Quiver Surf Drop</p>
        <h1 className="surf-drop-unavailable__title">{copy.title}</h1>
        <p className="surf-drop-unavailable__body">{copy.body}</p>
        <p className="surf-drop-unavailable__meta">
          {status !== "notfound" ? `${attribution}${area}.` : null}
        </p>
        <Link href="/" className="surf-drop-unavailable__cta">
          Back to Quiver
        </Link>
      </div>
    </ZineSurface>
  );
}
