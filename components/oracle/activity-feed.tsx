"use client";

export interface ActivityItem {
  id: string;
  userName: string;
  action: string;
  content?: string;
  timeAgo: string;
  initial: string;
  type: "session" | "intel";
}

export interface ActivityFeedProps {
  items: ActivityItem[];
}

const INK = "#11100D";
const STAMP_BLUE = "#0B3A75";

function AvatarCircle({
  initial,
  type,
}: {
  initial: string;
  type: "session" | "intel";
}) {
  // `.circled` is the zine's hand-drawn ring — the same mark used for
  // numbered callouts elsewhere in the guide.
  return (
    <div
      className="circled flex-shrink-0"
      style={{ color: type === "session" ? STAMP_BLUE : "#C2410C" }}
    >
      {initial}
    </div>
  );
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div>
      <h2 className="label-black mb-4">Activity</h2>

      {items.length === 0 ? (
        <div
          className="px-5 py-6 text-center"
          style={{
            background: "#F0E5CC",
            boxShadow: "2px 3px 0 rgba(0,0,0,0.16)",
          }}
        >
          <p
            className="mb-1"
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontSize: 16,
              textTransform: "uppercase",
              color: INK,
            }}
          >
            Intel board&apos;s empty
          </p>
          <p className="text-xs" style={{ color: INK, opacity: 0.68 }}>
            Be the first to drop some intel.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-3"
              style={
                i > 0
                  ? { borderTop: "1.5px dashed rgba(17,16,13,0.28)" }
                  : undefined
              }
            >
              <AvatarCircle initial={item.initial} type={item.type} />

              <div className="min-w-0 flex-1">
                <p className="text-sm" style={{ color: INK }}>
                  <span style={{ fontWeight: 700 }}>{item.userName}</span>{" "}
                  <span style={{ opacity: 0.8 }}>{item.action}</span>
                </p>
                {item.content && (
                  <p
                    className="mt-0.5 line-clamp-2 text-xs"
                    style={{ color: INK, opacity: 0.72 }}
                  >
                    {item.content}
                  </p>
                )}
                <p
                  className="mt-0.5"
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: INK,
                    opacity: 0.5,
                  }}
                >
                  {item.timeAgo}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
