import type { CityEditorialContent } from "@/types/editorial-content";

export function ReviewedCityEditorialSection({
  editorial,
}: {
  editorial: CityEditorialContent | null;
}) {
  if (!editorial?.seo_intro || !editorial.seo_local_guidance) return null;

  const sources = editorial.editorial_sources ?? [];
  return (
    <section className="my-8 rounded-xl border border-border/70 bg-card p-5">
      <h2 className="text-xl font-semibold text-foreground">Local planning guidance</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{editorial.seo_intro}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{editorial.seo_local_guidance}</p>
      {sources.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Reviewed sources: {sources.map((source) => source.publisher).filter(Boolean).join(", ")}.
        </p>
      )}
    </section>
  );
}
