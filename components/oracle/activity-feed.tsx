"use client";

export interface ActivityItem {
  id: string;
  userName: string;
  action: string;
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
  const gradient =
    type === "session"
      ? "from-[#3b82f6] to-[#8b5cf6]"
      : "from-[#f59e0b] to-[#ef4444]";

  return (
    <div
      className={`flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient}`}
    >
      <span className="text-sm font-bold text-white">{initial}</span>
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
        <p className="text-medium py-6 text-center text-sm">
          No local activity yet
        </p>
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
                <p className="text-medium text-xs">{item.timeAgo}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
