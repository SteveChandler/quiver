import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TideData {
  time: number;
  height: number;
  name: string;
}

interface TidesDisplayProps {
  tides: TideData[];
  className?: string;
  variant?: "default" | "compact";
}

export function TidesDisplay({
  tides,
  className,
  variant = "default",
}: TidesDisplayProps) {
  if (!tides || tides.length === 0) {
    return null;
  }

  const formatTideTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";

    if (hours > 12) {
      hours -= 12;
    } else if (hours === 0) {
      hours = 12;
    }

    const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
    return `${hours}:${minutesStr} ${ampm}`;
  };

  if (variant === "compact") {
    return (
      <div className={cn("space-y-1", className)}>
        {tides.slice(0, 2).map((tide, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-xs"
          >
            <span className="font-medium">{tide.name}</span>
            <span>
              {Math.round(tide.height * 10) / 10}ft @ {formatTideTime(tide.time)}
            </span>
          </div>
        ))}
        {tides.length > 2 && (
          <div className="text-xs text-muted-foreground">
            +{tides.length - 2} more
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-indigo-600" />
        <span className="text-sm font-medium">Tides</span>
      </div>
      <ul className="space-y-1">
        {tides.map((tide, index) => (
          <li
            key={index}
            className="flex justify-between items-center text-sm bg-gray-50 px-2 py-1 rounded"
          >
            <span className="font-medium">{tide.name}</span>
            <span>{Math.round(tide.height * 10) / 10}ft</span>
            <span className="text-right text-gray-600">
              {formatTideTime(tide.time)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface NextTideProps {
  tides: TideData[];
  className?: string;
}

export function NextTide({ tides, className }: NextTideProps) {
  if (!tides || tides.length === 0) {
    return null;
  }

  const now = Date.now() / 1000;
  const nextTide = tides.find((tide) => tide.time > now);

  if (!nextTide) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No upcoming tide data
      </div>
    );
  }

  const timeUntil = nextTide.time - now;
  const hoursUntil = Math.floor(timeUntil / 3600);
  const minutesUntil = Math.floor((timeUntil % 3600) / 60);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-3 w-3 text-indigo-600" />
      <span className="text-sm">
        Next {nextTide.name.toLowerCase()}: {nextTide.height}ft in{" "}
        {hoursUntil > 0 && `${hoursUntil}h `}
        {minutesUntil}m
      </span>
    </div>
  );
}

interface TideChartProps {
  tides: TideData[];
  className?: string;
}

export function TideChart({ tides, className }: TideChartProps) {
  if (!tides || tides.length === 0) {
    return null;
  }

  const maxHeight = Math.max(...tides.map((t) => t.height));
  const minHeight = Math.min(...tides.map((t) => t.height));
  const heightRange = maxHeight - minHeight;

  return (
    <div className={cn("relative h-16 bg-gray-50 rounded", className)}>
      <div className="absolute inset-0 flex items-end justify-between px-1">
        {tides.slice(0, 8).map((tide, index) => {
          const heightPercent =
            heightRange > 0
              ? ((tide.height - minHeight) / heightRange) * 100
              : 50;

          return (
            <div key={index} className="flex flex-col items-center">
              <div
                className={cn(
                  "w-2 rounded-t",
                  tide.name.toLowerCase().includes("high")
                    ? "bg-blue-500"
                    : "bg-blue-300"
                )}
                style={{ height: `${Math.max(heightPercent, 10)}%` }}
              />
              <span className="text-xs mt-1">
                {new Date(tide.time * 1000).getHours()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
