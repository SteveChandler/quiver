"use client";

import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckInWithUser, ForecastAccuracyStats } from "@/types/database";
import { formatWaterTemp, formatWindSpeed } from "@/lib/formatters/surf-data";
import {
  Waves,
  Wind,
  Thermometer,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

interface CheckInDisplayProps {
  checkIn: CheckInWithUser;
  showUser?: boolean;
  compact?: boolean;
  className?: string;
}

interface CheckInFeedProps {
  checkIns: CheckInWithUser[];
  title?: string;
  emptyMessage?: string;
  className?: string;
}

interface ForecastAccuracyDisplayProps {
  stats: ForecastAccuracyStats;
  className?: string;
}

const accuracyConfig = {
  accurate: {
    icon: CheckCircle2,
    label: "Accurate",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  somewhat: {
    icon: AlertCircle,
    label: "Somewhat",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  inaccurate: {
    icon: XCircle,
    label: "Inaccurate",
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  unknown: {
    icon: AlertCircle,
    label: "—",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
};

const windDirectionLabels: Record<string, string> = {
  N: "North",
  NE: "Northeast",
  E: "East",
  SE: "Southeast",
  S: "South",
  SW: "Southwest",
  W: "West",
  NW: "Northwest",
  OFFSHORE: "Offshore",
  ONSHORE: "Onshore",
  CROSS: "Cross-shore",
};

function formatConditionValue(value: number | null, unit: string): string {
  return value !== null ? `${value}${unit}` : "—";
}

function getCrowdLabel(level: number | null): string {
  if (!level) return "—";
  const labels = ["", "Empty", "Light", "Moderate", "Busy", "Packed"];
  return labels[level] || "Unknown";
}

export function CheckInDisplay({
  checkIn,
  showUser = true,
  compact = false,
  className,
}: CheckInDisplayProps) {
  const accuracyKey =
    (checkIn.forecast_accuracy_rating as keyof typeof accuracyConfig | null) ??
    "unknown";
  const accuracyInfo = accuracyConfig[accuracyKey] ?? accuracyConfig.unknown;
  const IconComponent = accuracyInfo.icon;

  return (
    <Card className={className}>
      <CardContent className={compact ? "p-4" : "p-6"}>
        {showUser && (
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-8 w-8">
              <AvatarImage src={checkIn.user.profile_picture_url || ""} />
              <AvatarFallback>
                {checkIn.user.username?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {checkIn.user.username || "Anonymous"}
                </span>
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDistanceToNow(new Date(checkIn.checked_in_at), {
                    addSuffix: true,
                  })}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Conditions Grid */}
        <div
          className={`grid gap-3 ${
            compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
          }`}
        >
          {/* Wave Height */}
          {checkIn.wave_height !== null && (
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">
                  {formatConditionValue(checkIn.wave_height, "ft")}
                </div>
                <div className="text-xs text-gray-500">Waves</div>
              </div>
            </div>
          )}

          {/* Wind */}
          {(checkIn.wind_speed !== null || checkIn.wind_direction !== null) && (
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">
                  {checkIn.wind_speed !== null
                    ? formatWindSpeed(checkIn.wind_speed)
                    : "—"}
                </div>
                <div className="text-xs text-gray-500">
                  {checkIn.wind_direction
                    ? windDirectionLabels[checkIn.wind_direction] ||
                      checkIn.wind_direction
                    : "Wind"}
                </div>
              </div>
            </div>
          )}

          {/* Water Temperature */}
          {checkIn.water_temp !== null && (
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">
                  {formatWaterTemp(checkIn.water_temp)}
                </div>
                <div className="text-xs text-gray-500">Water</div>
              </div>
            </div>
          )}

          {/* Crowd Level */}
          {checkIn.crowd_level !== null && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">
                  {getCrowdLabel(checkIn.crowd_level)}
                </div>
                <div className="text-xs text-gray-500">Crowd</div>
              </div>
            </div>
          )}
        </div>

        {/* Forecast Accuracy */}
        <div className="mt-4 flex items-center gap-2">
          <IconComponent className={`h-4 w-4 ${accuracyInfo.color}`} />
          <span className="text-sm">
            Forecast was{" "}
            <span className="font-medium">
              {accuracyInfo.label.toLowerCase()}
            </span>
          </span>
        </div>

        {/* Vibe/Notes */}
        {checkIn.vibe && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 italic">“{checkIn.vibe}”</p>
          </div>
        )}

        {!showUser && (
          <div className="mt-3 text-xs text-gray-500">
            {formatDistanceToNow(new Date(checkIn.checked_in_at), {
              addSuffix: true,
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CheckInFeed({
  checkIns,
  title = "Recent Conditions",
  emptyMessage = "No recent check-ins available",
  className,
}: CheckInFeedProps) {
  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}

      {checkIns.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Waves className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">{emptyMessage}</p>
            <p className="text-sm text-gray-400 mt-1">
              Be the first to report conditions!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {checkIns.map((checkIn) => (
            <CheckInDisplay
              key={checkIn.id}
              checkIn={checkIn}
              showUser={true}
              compact={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ForecastAccuracyDisplay({
  stats,
  className,
}: ForecastAccuracyDisplayProps) {
  if (stats.total_reports === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No accuracy data yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getAccuracyColor = (percentage: number) => {
    if (percentage >= 70) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getAccuracyBgColor = (percentage: number) => {
    if (percentage >= 70) return "bg-green-100";
    if (percentage >= 50) return "bg-yellow-100";
    return "bg-red-100";
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">Forecast Accuracy</h4>
          <Badge
            variant="secondary"
            className={`${getAccuracyBgColor(
              stats.accuracy_percentage
            )} ${getAccuracyColor(stats.accuracy_percentage)}`}
          >
            {stats.accuracy_percentage.toFixed(0)}%
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">
              Based on {stats.total_reports} reports
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 text-xs">
            <div className="text-center">
              <div className="font-medium text-green-600">
                {stats.accurate_count}
              </div>
              <div className="text-gray-500">Accurate</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-yellow-600">
                {stats.somewhat_count}
              </div>
              <div className="text-gray-500">Somewhat</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-red-600">
                {stats.inaccurate_count}
              </div>
              <div className="text-gray-500">Inaccurate</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
