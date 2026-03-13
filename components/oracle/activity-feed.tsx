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

function AvatarCircle({
  initial,
  type,
}: {
  initial: string;
  type: "session" | "intel";
}) {
  const bgClass =
    type === "session" ? "bg-[#3A4499]" : "bg-[#F78E42]/20";
  const textClass =
    type === "session" ? "text-[#FDB84B]" : "text-[#F78E42]";

  return (
    <div
      className={`flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full ${bgClass}`}
    >
      <span className={`text-sm font-bold ${textClass}`}>{initial}</span>
    </div>
  );
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div>
      <h2 className="font-heading mb-3 text-lg font-semibold text-white">
        Activity
      </h2>

      {items.length === 0 ? (
        <div className="noise-texture rounded-xl border border-[#404C92] bg-[#2D357D] p-5 text-center">
          <p className="text-high text-sm font-semibold mb-1">Your local lineup is quiet</p>
          <p className="text-medium text-xs">
            Log a session to see what your crew is up to — or be the first to post.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-[#404C92] bg-[#2D357D] p-4"
            >
              <AvatarCircle initial={item.initial} type={item.type} />

              <div className="min-w-0 flex-1">
                <p className="text-high text-sm">
                  <span className="font-semibold text-white">
                    {item.userName}
                  </span>{" "}
                  {item.action}
                </p>
                {item.content && (
                  <p className="text-medium text-xs line-clamp-2 mt-0.5">{item.content}</p>
                )}
                <p className="text-medium text-xs">{item.timeAgo}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
