import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";

interface ConfidenceFactors {
  dataFreshness?: number;
  sourceReliability?: number;
  weatherConditions?: number;
  historicalAccuracy?: number;
}

interface HistoricalAccuracy {
  last30Days?: number | null;
  last7Days?: number | null;
  totalSessions: number;
}

interface ConfidenceScoreExplanationProps {
  score: number;
  factors?: ConfidenceFactors;
  explanation?: string;
  userFriendlyText?: string;
  historicalAccuracy?: HistoricalAccuracy;
  beachName?: string;
  showFactors?: boolean;
  showTooltips?: boolean;
  showWarning?: boolean;
  showHelpLink?: boolean;
  expandable?: boolean;
  compact?: boolean;
  className?: string;
}

export function ConfidenceScoreExplanation({
  score,
  factors,
  explanation,
  userFriendlyText,
  historicalAccuracy,
  beachName,
  showFactors = false,
  showTooltips = false,
  showWarning = false,
  showHelpLink = false,
  expandable = false,
  compact = false,
  className,
}: ConfidenceScoreExplanationProps) {
  const [isExpanded, setIsExpanded] = React.useState(showFactors);

  // Determine confidence level and styling
  const getConfidenceLevel = (confidenceScore: number) => {
    if (confidenceScore >= 75)
      return {
        level: "High Confidence",
        color: "green",
        bgColor: "bg-green-50",
        textColor: "text-green-600",
        description: "Forecast is very reliable - great data quality!",
      };
    if (confidenceScore >= 50)
      return {
        level: "Moderate Confidence",
        color: "yellow",
        bgColor: "bg-yellow-50",
        textColor: "text-yellow-600",
        description:
          "Forecast is reasonably accurate - check conditions before heading out",
      };
    return {
      level: "Low Confidence",
      color: "red",
      bgColor: "bg-red-50",
      textColor: "text-red-600",
      description:
        "Forecast may be unreliable - consider checking local conditions",
    };
  };

  const confidenceInfo = getConfidenceLevel(score);

  // Get factor status and styling
  const getFactorStatus = (factorValue?: number) => {
    if (!factorValue) return { status: "Unknown", color: "gray" };
    if (factorValue >= 70) return { status: "Good", color: "green" };
    if (factorValue >= 40) return { status: "Fair", color: "yellow" };
    return { status: "Poor", color: "red" };
  };

  // Factor explanations for tooltips
  const factorExplanations = {
    dataFreshness: {
      title: "Data Freshness",
      description: "How recent the forecast data is",
      details:
        factors?.dataFreshness && factors.dataFreshness > 70
          ? "Updated within the last 3 hours"
          : "Data may be outdated",
    },
    sourceReliability: {
      title: "Source Reliability",
      description: "Quality and accuracy of data sources",
      details: "Based on historical performance of NOAA and CDIP data",
    },
    weatherConditions: {
      title: "Weather Conditions",
      description: "Current weather stability",
      details: "Stable conditions improve forecast accuracy",
    },
    historicalAccuracy: {
      title: "Historical Accuracy",
      description: "Past forecast performance at this location",
      details: "Based on user feedback and session data",
    },
  };

  if (compact) {
    return (
      <div
        className={cn("flex items-center space-x-2", className)}
        data-testid="confidence-score-compact"
      >
        <Badge
          variant={confidenceInfo.color === "green" ? "default" : "secondary"}
          className={cn("text-xs", {
            "bg-green-100 text-green-700": confidenceInfo.color === "green",
            "bg-yellow-100 text-yellow-700": confidenceInfo.color === "yellow",
            "bg-red-100 text-red-700": confidenceInfo.color === "red",
          })}
        >
          {score}%
        </Badge>
        {userFriendlyText && (
          <span className="text-xs text-gray-600">{userFriendlyText}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main confidence score display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "flex items-center justify-center w-16 h-16 rounded-full text-lg font-bold",
              confidenceInfo.bgColor,
              confidenceInfo.textColor
            )}
            data-testid="confidence-score"
            aria-label={`Forecast confidence: ${score}% - ${confidenceInfo.level}`}
          >
            {score}%
          </div>
          <div>
            <h3 className={cn("font-medium", confidenceInfo.textColor)}>
              {confidenceInfo.level}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {userFriendlyText || confidenceInfo.description}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {expandable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs"
              aria-label="Show details"
            >
              <Info className="h-4 w-4 mr-1" />
              {isExpanded ? (
                <>
                  Hide <ChevronUp className="h-3 w-3 ml-1" />
                </>
              ) : (
                <>
                  Details <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          )}

          {showHelpLink && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/help/forecast-confidence" className="text-xs">
                <HelpCircle className="h-4 w-4 mr-1" />
                Learn about confidence scores
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Warning for low confidence */}
      {(showWarning || score < 50) && score < 50 && (
        <Alert
          className="border-red-200 bg-red-50"
          data-testid="confidence-warning"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Low Confidence Warning:</strong>{" "}
            {userFriendlyText || confidenceInfo.description}
          </AlertDescription>
        </Alert>
      )}

      {/* Historical accuracy */}
      {historicalAccuracy && beachName && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium mb-2">
            Historical accuracy at {beachName}
          </h4>
          {historicalAccuracy.totalSessions < 10 ? (
            <div className="text-sm text-gray-600">
              <p>Limited historical data available</p>
              <p className="text-xs">
                Only {historicalAccuracy.totalSessions} sessions recorded
              </p>
              <p className="text-xs">Accuracy will improve with more data</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {historicalAccuracy.last30Days && (
                <div className="flex justify-between">
                  <span>Last 30 days:</span>
                  <span className="font-medium">
                    {historicalAccuracy.last30Days}%
                  </span>
                </div>
              )}
              <p className="text-xs text-gray-500">
                Based on {historicalAccuracy.totalSessions} user sessions
              </p>
            </div>
          )}
        </div>
      )}

      {/* Expanded details */}
      {(isExpanded || showFactors) && factors && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Confidence Breakdown</h4>
            <span className="text-xs text-gray-500">
              How we calculate this score
            </span>
          </div>

          <div className="space-y-3">
            {/* Data Freshness Factor */}
            {factors.dataFreshness !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">Data Freshness</span>
                    {showTooltips && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div data-testid="data-freshness-tooltip">
                              <Info className="h-3 w-3 text-gray-400" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div>
                              <h5 className="font-medium">
                                {factorExplanations.dataFreshness.title}
                              </h5>
                              <p className="text-xs">
                                {factorExplanations.dataFreshness.description}
                              </p>
                              <p className="text-xs mt-1">
                                {factorExplanations.dataFreshness.details}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Progress
                      value={factors.dataFreshness}
                      className="w-16 h-2"
                    />
                    <span
                      className={cn("text-sm font-medium", {
                        "text-green-600": factors.dataFreshness >= 70,
                        "text-yellow-600":
                          factors.dataFreshness >= 40 &&
                          factors.dataFreshness < 70,
                        "text-red-600": factors.dataFreshness < 40,
                      })}
                      data-testid="factor-data-freshness"
                    >
                      {factors.dataFreshness}%
                    </span>
                  </div>
                </div>
                {factors.dataFreshness < 40 && (
                  <p className="text-xs text-red-600">Outdated data</p>
                )}
              </div>
            )}

            {/* Source Reliability Factor */}
            {factors.sourceReliability !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Source Reliability</span>
                  <div className="flex items-center space-x-2">
                    <Progress
                      value={factors.sourceReliability}
                      className="w-16 h-2"
                    />
                    <span className="text-sm font-medium">
                      {factors.sourceReliability}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Weather Conditions Factor */}
            {factors.weatherConditions !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weather Conditions</span>
                  <div className="flex items-center space-x-2">
                    <Progress
                      value={factors.weatherConditions}
                      className="w-16 h-2"
                    />
                    <span className="text-sm font-medium">
                      {factors.weatherConditions}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Accuracy Factor */}
            {factors.historicalAccuracy !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Historical Accuracy</span>
                  <div className="flex items-center space-x-2">
                    <Progress
                      value={factors.historicalAccuracy}
                      className="w-16 h-2"
                    />
                    <span className="text-sm font-medium">
                      {factors.historicalAccuracy}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {explanation && (
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">{explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
