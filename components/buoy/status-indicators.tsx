import { Badge } from "@/components/ui/badge";
import { Clock, Wifi, WifiOff, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "online" | "offline" | "stale" | "error";
  lastUpdate?: Date | string;
  className?: string;
}

export function BuoyStatusIndicator({
  status,
  lastUpdate,
  className,
}: StatusIndicatorProps) {
  const statusConfig = {
    online: {
      color: "bg-green-500",
      icon: <Wifi className="h-3 w-3" />,
      label: "Online",
      variant: "default" as const,
    },
    offline: {
      color: "bg-gray-500",
      icon: <WifiOff className="h-3 w-3" />,
      label: "Offline",
      variant: "secondary" as const,
    },
    stale: {
      color: "bg-yellow-500",
      icon: <Clock className="h-3 w-3" />,
      label: "Stale Data",
      variant: "outline" as const,
    },
    error: {
      color: "bg-red-500",
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Error",
      variant: "destructive" as const,
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", config.color)} />
      <Badge variant={config.variant} className="text-xs">
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </Badge>
      {lastUpdate && (
        <span className="text-xs text-muted-foreground">
          {formatLastUpdate(lastUpdate)}
        </span>
      )}
    </div>
  );
}

function formatLastUpdate(date: Date | string): string {
  const now = new Date();
  const updateTime = new Date(date);
  const diffMs = now.getTime() - updateTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return updateTime.toLocaleDateString();
  }
}

interface ConditionBadgeProps {
  type: "excellent" | "good" | "fair" | "poor" | "unknown";
  label?: string;
  className?: string;
}

export function ConditionBadge({
  type,
  label,
  className,
}: ConditionBadgeProps) {
  const conditions = {
    excellent: {
      color: "bg-green-500 text-white",
      label: label || "Excellent",
    },
    good: {
      color: "bg-blue-500 text-white",
      label: label || "Good",
    },
    fair: {
      color: "bg-yellow-500 text-white",
      label: label || "Fair",
    },
    poor: {
      color: "bg-red-500 text-white",
      label: label || "Poor",
    },
    unknown: {
      color: "bg-gray-500 text-white",
      label: label || "Unknown",
    },
  };

  const config = conditions[type];

  return <Badge className={cn(config.color, className)}>{config.label}</Badge>;
}

interface WaveQualityBadgeProps {
  waveHeight?: number;
  className?: string;
}

export function WaveQualityBadge({
  waveHeight,
  className,
}: WaveQualityBadgeProps) {
  if (!waveHeight) {
    return (
      <ConditionBadge type="unknown" label="No Data" className={className} />
    );
  }

  let type: "excellent" | "good" | "fair" | "poor";
  let label: string;

  if (waveHeight < 2) {
    type = "poor";
    label = "Small";
  } else if (waveHeight < 4) {
    type = "good";
    label = "Good";
  } else if (waveHeight < 6) {
    type = "excellent";
    label = "Great";
  } else {
    type = "excellent";
    label = "Epic";
  }

  return <ConditionBadge type={type} label={label} className={className} />;
}

interface DataFreshnessIndicatorProps {
  timestamp: Date | string;
  className?: string;
}

export function DataFreshnessIndicator({
  timestamp,
  className,
}: DataFreshnessIndicatorProps) {
  const now = new Date();
  const dataTime = new Date(timestamp);
  const diffHours = (now.getTime() - dataTime.getTime()) / (1000 * 60 * 60);

  let status: "online" | "stale" | "offline";

  if (diffHours < 1) {
    status = "online";
  } else if (diffHours < 6) {
    status = "stale";
  } else {
    status = "offline";
  }

  return (
    <BuoyStatusIndicator
      status={status}
      lastUpdate={timestamp}
      className={className}
    />
  );
}
