'use client';

type AttributionBadgeProps = {
  html?: string | null;
};

export function AttributionBadge({ html }: AttributionBadgeProps) {
  if (!html) return null;
  return (
    <div className="mt-1 text-[11px] text-muted-foreground/90">
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
