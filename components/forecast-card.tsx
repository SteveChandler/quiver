import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Waves,
  Thermometer,
  Wind,
  Clock,
  Droplets,
  Cloud,
  TrendingUp,
  TrendingDown,
  Activity,
  Compass,
  Info,
} from "lucide-react";
import {
  formatForecastTime,
  formatForecastDate,
  getConfidenceColor,
  getConfidenceIndicatorColor,
  getTideStatusIcon,
} from "@/lib/utils/forecast-ui-utils";
import type { Forecast } from "@/types/database";

// Enhanced forecast interface (superset of basic forecast)
interface EnhancedForecastData extends Partial<Forecast> {
  // Enhanced fields
  wave_period?: string | null;
  wave_direction?: string | null;
  swell_1_height?: string | null;
  swell_1_period?: string | null;
  swell_1_direction?: string | null;
  swell_2_height?: string | null;
  swell_2_period?: string | null;
  swell_2_direction?: string | null;
  wind_wave_height?: string | null;
  wind_wave_period?: string | null;
  wind_wave_direction?: string | null;
  air_temperature?: string;
  tide_status?: string;
  tide_height?: string;
  next_tide_time?: string;
  next_tide_type?: string;
  next_tide_height?: string;
  current_speed?: string;
  current_direction?: string;
  confidence_score?: number;
}

interface ForecastCardProps {
  // Unified interface - can accept either simple or enhanced forecast data
  forecast?: EnhancedForecastData;

  // Legacy props for backwards compatibility
  beachName?: string;
  waveHeight?: string;
  waterTemp?: string;
  windSpeed?: string;
  tide?: string;
  time?: string;
  windDirection?: string;
  weatherCondition?: string;
  beachId?: string;

  // Display options
  variant?: "default" | "compact" | "detailed" | "legacy";
  showDate?: boolean;
  showBeachName?: boolean;
}

export function ForecastCard({
  forecast,
  beachName,
  waveHeight,
  waterTemp,
  windSpeed,
  tide,
  time,
  windDirection,
  weatherCondition,
  beachId,
  variant = "default",
  showDate = true,
  showBeachName = true,
}: ForecastCardProps) {
  // Normalize data - use forecast object if provided, otherwise use legacy props
  const data = forecast
    ? {
        beachName: beachName || "Beach",
        waveHeight: forecast.wave_height || waveHeight || "No data",
        waterTemp: forecast.water_temp || waterTemp || "No data",
        windSpeed: forecast.wind_speed || windSpeed || "No data",
        tide: forecast.tide || tide || "Unknown",
        time:
          forecast.forecast_date && forecast.forecast_time
            ? `${formatForecastDate(
                forecast.forecast_date
              )} ${formatForecastTime(forecast.forecast_time)}`
            : time || "Now",
        windDirection: forecast.wind_direction || windDirection,
        weatherCondition:
          forecast.weather_condition || weatherCondition || "Partly Cloudy",
        // Enhanced fields
        wavePeriod: forecast.wave_period,
        waveDirection: forecast.wave_direction,
        airTemp: forecast.air_temperature,
        tideStatus: forecast.tide_status,
        tideHeight: forecast.tide_height,
        nextTideTime: forecast.next_tide_time,
        nextTideType: forecast.next_tide_type,
        nextTideHeight: forecast.next_tide_height,
        currentSpeed: forecast.current_speed,
        currentDirection: forecast.current_direction,
        confidenceScore: forecast.confidence_score,
        // Swell data
        swell1Height: forecast.swell_1_height,
        swell1Period: forecast.swell_1_period,
        swell1Direction: forecast.swell_1_direction,
        swell2Height: forecast.swell_2_height,
        swell2Period: forecast.swell_2_period,
        swell2Direction: forecast.swell_2_direction,
        windWaveHeight: forecast.wind_wave_height,
        windWavePeriod: forecast.wind_wave_period,
        windWaveDirection: forecast.wind_wave_direction,
      }
    : {
        beachName: beachName || "Beach",
        waveHeight: waveHeight || "No data",
        waterTemp: waterTemp || "No data",
        windSpeed: windSpeed || "No data",
        tide: tide || "Unknown",
        time: time || "Now",
        windDirection,
        weatherCondition: weatherCondition || "Partly Cloudy",
      };

  const getTideIcon = (status?: string) => {
    if (!status) return <Activity className="h-4 w-4" />;
    const iconType = getTideStatusIcon(status);
    if (iconType === "up") return <TrendingUp className="h-4 w-4" />;
    if (iconType === "down") return <TrendingDown className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  // Legacy variant for backwards compatibility
  if (variant === "legacy") {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-primary p-3 text-primary-foreground">
            <div className="flex justify-between items-center">
              {showBeachName && (
                <h3 className="font-semibold">{data.beachName}</h3>
              )}
              <span className="text-sm flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {data.time}
              </span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Wave Height</p>
                  <p className="font-medium">{data.waveHeight}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Water Temp</p>
                  <p className="font-medium">{data.waterTemp}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Wind</p>
                  <p className="font-medium">
                    {data.windSpeed}{" "}
                    {data.windDirection && `(${data.windDirection})`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Tide</p>
                  <p className="font-medium">{data.tide}</p>
                </div>
              </div>
            </div>

            {data.weatherCondition && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {data.weatherCondition}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            {showDate && showBeachName && (
              <div className="text-sm font-medium">{data.time}</div>
            )}
            {data.confidenceScore && (
              <Badge
                className={`text-xs ${getConfidenceColor(
                  data.confidenceScore
                )}`}
              >
                {data.confidenceScore}% confidence
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-blue-600" />
              <span>{data.waveHeight}</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              <span>{data.tideStatus || data.tide}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-gray-600" />
              <span>{data.windSpeed}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default and detailed variants
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground p-4">
        <div className="flex justify-between items-center">
          <div>
            {showBeachName && (
              <h3 className="font-semibold text-lg">{data.beachName}</h3>
            )}
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Clock className="h-4 w-4" />
              {data.time}
            </div>
          </div>
          <div className="text-right">
            {data.confidenceScore && (
              <Badge
                className={`text-xs ${getConfidenceColor(
                  data.confidenceScore
                )}`}
              >
                {data.confidenceScore}% confidence
              </Badge>
            )}
            <div className="text-sm mt-1 opacity-90">
              {data.weatherCondition}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Core Wave Information */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Waves className="h-5 w-5 text-blue-600" />
            Wave Conditions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Wave Height</p>
              <p className="font-medium text-lg">{data.waveHeight}</p>
            </div>
            {data.wavePeriod && (
              <div>
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="font-medium">{data.wavePeriod}</p>
              </div>
            )}
            {data.waveDirection && (
              <div>
                <p className="text-sm text-muted-foreground">Direction</p>
                <p className="font-medium flex items-center gap-1">
                  <Compass className="h-3 w-3" />
                  {data.waveDirection}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Swell Data for detailed variant */}
        {variant === "detailed" &&
          (data.swell1Height || data.swell2Height || data.windWaveHeight) && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                Swell Components
              </h4>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Primary Swell
                    </p>
                    <p className="font-medium text-sm">
                      {data.swell1Height || "No data"}
                    </p>
                    <p className="text-xs">
                      {data.swell1Period || "No data"} •{" "}
                      {data.swell1Direction || "No data"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Secondary Swell
                    </p>
                    <p className="font-medium text-sm">
                      {data.swell2Height || "No data"}
                    </p>
                    <p className="text-xs">
                      {data.swell2Period || "No data"} •{" "}
                      {data.swell2Direction || "No data"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Wind Waves</p>
                    <p className="font-medium text-sm">
                      {data.windWaveHeight || "No data"}
                    </p>
                    <p className="text-xs">
                      {data.windWavePeriod || "No data"} •{" "}
                      {data.windWaveDirection || "No data"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Weather Conditions */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Cloud className="h-5 w-5 text-gray-600" />
            Weather
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Water Temp</p>
              <p className="font-medium flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-blue-500" />
                {data.waterTemp}
              </p>
            </div>
            {data.airTemp && (
              <div>
                <p className="text-sm text-muted-foreground">Air Temp</p>
                <p className="font-medium flex items-center gap-1">
                  <Thermometer className="h-3 w-3 text-orange-500" />
                  {data.airTemp}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Wind</p>
              <p className="font-medium flex items-center gap-1">
                <Wind className="h-3 w-3 text-gray-600" />
                {data.windSpeed}
              </p>
              {data.windDirection && (
                <p className="text-xs text-muted-foreground">
                  {data.windDirection}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conditions</p>
              <p className="font-medium text-sm">{data.weatherCondition}</p>
            </div>
          </div>
        </div>

        {/* Enhanced Tide Information */}
        {(data.tideStatus || data.tideHeight) && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              Tides & Currents
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getTideIcon(data.tideStatus)}
                  <span className="font-medium">
                    {data.tideStatus || data.tide}
                  </span>
                </div>
                {data.tideHeight && (
                  <p className="text-sm text-muted-foreground">
                    Current height: {data.tideHeight}
                  </p>
                )}
                {data.nextTideType !== "Unknown" && data.nextTideType && (
                  <p className="text-sm text-muted-foreground">
                    Next {data.nextTideType.toLowerCase()}:{" "}
                    {data.nextTideHeight} at {data.nextTideTime}
                  </p>
                )}
              </div>

              {data.currentSpeed && data.currentSpeed !== "0 knots" && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-sm mb-1">Tidal Currents</p>
                  <p className="text-sm">Speed: {data.currentSpeed}</p>
                  <p className="text-sm">Direction: {data.currentDirection}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quality Indicator for enhanced data */}
        {data.confidenceScore && (
          <div className="pt-3 border-t">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Forecast Reliability</span>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${getConfidenceIndicatorColor(
                    data.confidenceScore
                  )}`}
                />
                <span>{data.confidenceScore}% confidence</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
