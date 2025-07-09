"use client";

import { cn } from "@/lib/utils";
import {
  Satellite,
  Waves,
  Wind,
  Thermometer,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataSourceInfo {
  name: string;
  type: "wave" | "tide" | "weather" | "buoy";
  status: "active" | "fallback" | "unavailable";
  confidence: number;
  lastUpdated?: string;
  description?: string;
}

interface ForecastDataTransparencyProps {
  dataSources: DataSourceInfo[];
  overallConfidence: number;
  className?: string;
  variant?: "compact" | "detailed";
}

// Helper functions used by multiple components
const getDataTypeIcon = (type: DataSourceInfo["type"]) => {
  switch (type) {
    case "wave":
      return Waves;
    case "tide":
      return Satellite;
    case "weather":
      return Wind;
    case "buoy":
      return Thermometer;
    default:
      return Info;
  }
};

const getStatusInfo = (status: DataSourceInfo["status"]) => {
  switch (status) {
    case "active":
      return {
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        label: "Active",
      };
    case "fallback":
      return {
        icon: AlertCircle,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        label: "Fallback",
      };
    case "unavailable":
      return {
        icon: XCircle,
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        label: "Unavailable",
      };
  }
};

export function ForecastDataTransparency({
  dataSources,
  overallConfidence,
  variant = "detailed",
  className,
}: ForecastDataTransparencyProps) {
  // Handle undefined or empty dataSources
  if (!dataSources || dataSources.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center">
              <Info className="h-3 w-3 text-gray-600" />
            </div>
            <span className="text-sm font-medium">Data Quality</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-500" />
            <span className="text-sm font-medium">
              No data sources available
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center">
              <Info className="h-3 w-3 text-gray-600" />
            </div>
            <span className="text-sm font-medium">Data Quality</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-3 w-3 rounded-full",
                overallConfidence >= 80
                  ? "bg-green-500"
                  : overallConfidence >= 60
                  ? "bg-yellow-500"
                  : "bg-red-500"
              )}
            />
            <span className="text-sm font-medium">{overallConfidence}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {dataSources.slice(0, 4).map((source, index) => (
            <div key={index} className="flex items-center gap-1">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  source.status === "active"
                    ? "bg-green-500"
                    : source.status === "fallback"
                    ? "bg-blue-500"
                    : source.status === "unavailable"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                )}
              />
              <span className="text-muted-foreground truncate">
                {source.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold">Data Transparency</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Overall Confidence:
          </span>
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "h-3 w-3 rounded-full",
                overallConfidence >= 80
                  ? "bg-green-500"
                  : overallConfidence >= 60
                  ? "bg-yellow-500"
                  : "bg-red-500"
              )}
            />
            <span className="font-medium">{overallConfidence}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {dataSources.map((source, index) => {
          const Icon = getDataTypeIcon(source.type);
          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                source.status === "active"
                  ? "bg-green-50 border-green-200"
                  : source.status === "fallback"
                  ? "bg-blue-50 border-blue-200"
                  : source.status === "unavailable"
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              )}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200">
                <Icon className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {source.name}
                  </span>
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      source.status === "active"
                        ? "bg-green-500"
                        : source.status === "fallback"
                        ? "bg-blue-500"
                        : source.status === "unavailable"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    )}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated: {source.lastUpdated}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DataSourceBadge({
  source,
  className,
}: {
  source: DataSourceInfo;
  className?: string;
}) {
  const statusInfo = getStatusInfo(source.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs",
        statusInfo.bgColor,
        statusInfo.borderColor,
        "border",
        className
      )}
    >
      <StatusIcon className={cn("h-3 w-3", statusInfo.color)} />
      <span>{source.name}</span>
    </div>
  );
}

// Helper function to create mock data sources for development
export function createMockDataSources(): DataSourceInfo[] {
  return [
    {
      name: "NOAA WaveWatch III",
      type: "wave",
      status: "active",
      confidence: 85,
      lastUpdated: "2 hours ago",
      description: "Global wave model with 3-hour updates",
    },
    {
      name: "NOAA CO-OPS",
      type: "tide",
      status: "active",
      confidence: 90,
      lastUpdated: "1 hour ago",
      description: "Official tidal predictions and observations",
    },
    {
      name: "NOAA Weather Service",
      type: "weather",
      status: "active",
      confidence: 80,
      lastUpdated: "30 minutes ago",
      description: "Hourly weather forecasts and observations",
    },
    {
      name: "NDBC Buoy Network",
      type: "buoy",
      status: "fallback",
      confidence: 70,
      lastUpdated: "4 hours ago",
      description: "Real-time buoy measurements (using nearest station)",
    },
  ];
}
