import Link from "next/link";

interface TideHubListProps {
  /** An item without `href` prints as plain text (a closed station keeps its place in the count). */
  items: Array<{ key: string; name: string; href?: string; meta?: string }>;
  label: string;
}

const ROW = "flex min-h-11 items-center justify-between gap-3 border-b border-dashed border-[#11100D]/30 py-2";

export function TideHubList({ items, label }: TideHubListProps) {
  return (
    <ul aria-label={label} className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3" data-testid="tide-hub-list">
      {items.map((item) => {
        const body = (
          <>
            <span className="font-semibold">{item.name}</span>
            {item.meta && <span className="shrink-0 font-mono text-xs text-[#11100D]/60">{item.meta}</span>}
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className={`${ROW} hover:text-[#AA4918]`}>
                {body}
              </Link>
            ) : (
              <div className={ROW}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
