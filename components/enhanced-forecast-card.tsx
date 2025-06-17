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

interface EnhancedForecastCardProps {
  forecast: {
    forecast_date: string;
    forecast_time: string;
    wave_height: string;
    wave_period: string;
    wave_direction: string;
    swell_1_height: string;
    swell_1_period: string;
    swell_1_direction: string;
    swell_2_height: string;
    swell_2_period: string;
    swell_2_direction: string;
    wind_wave_height: string;
    wind_wave_period: string;
    wind_wave_direction: string;
    water_temp: string;
    air_temperature: string;
    wind_speed: string;
    wind_direction: string;
    tide_status: string;
    tide_height: string;
    next_tide_time: string;
    next_tide_type: string;
    next_tide_height: string;
    current_speed: string;
    current_direction: string;
    weather_condition: string;
    confidence_score: number;
  };
  variant?: "default" | "compact" | "detailed";
  showDate?: boolean;
}

export function EnhancedForecastCard({
  forecast,
  variant = "default",
  showDate = true,
}: EnhancedForecastCardProps) {
  const getTideIcon = (status: string) => {
    const iconType = getTideStatusIcon(status);
    if (iconType === "up") return <TrendingUp className="h-4 w-4" />;
    if (iconType === "down") return <TrendingDown className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  if (variant === "compact") {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            {showDate && (
              <div className="text-sm font-medium">
                {formatForecastDate(forecast.forecast_date)}{" "}
                {formatForecastTime(forecast.forecast_time)}
              </div>
            )}
            <Badge
              className={`text-xs ${getConfidenceColor(
                forecast.confidence_score
              )}`}
            >
              {forecast.confidence_score}% confidence
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-blue-600" />
              <span>{forecast.wave_height}</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              <span>{forecast.tide_status}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-gray-600" />
              <span>{forecast.wind_speed}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground p-4">
        <div className="flex justify-between items-center">
          <div>
            {showDate && (
              <h3 className="font-semibold text-lg">
                {formatForecastDate(forecast.forecast_date)}
              </h3>
            )}
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Clock className="h-4 w-4" />
              {formatForecastTime(forecast.forecast_time)}
            </div>
          </div>
          <div className="text-right">
            <Badge
              className={`text-xs ${getConfidenceColor(
                forecast.confidence_score
              )}`}
            >
              {forecast.confidence_score}% confidence
            </Badge>
            <div className="text-sm mt-1 opacity-90">
              {forecast.weather_condition}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Wave Summary */}
        <div className="space-y-3">
          <h4 className="font-medium text-lg flex items-center gap-2">
            <Waves className="h-5 w-5 text-blue-600" />
            Wave Conditions
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Wave Height</p>
              <p className="font-semibold text-lg text-blue-600">
                {forecast.wave_height}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Period</p>
              <p className="font-medium">{forecast.wave_period}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Direction</p>
              <p className="font-medium flex items-center gap-1">
                <Compass className="h-3 w-3" />
                {forecast.wave_direction}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Swell Information */}
        {variant === "detailed" && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Swell Components
            </h4>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Primary Swell</p>
                  <p className="font-medium text-sm">
                    {forecast.swell_1_height}
                  </p>
                  <p className="text-xs">
                    {forecast.swell_1_period} • {forecast.swell_1_direction}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Secondary Swell
                  </p>
                  <p className="font-medium text-sm">
                    {forecast.swell_2_height}
                  </p>
                  <p className="text-xs">
                    {forecast.swell_2_period} • {forecast.swell_2_direction}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Wind Waves</p>
                  <p className="font-medium text-sm">
                    {forecast.wind_wave_height}
                  </p>
                  <p className="text-xs">
                    {forecast.wind_wave_period} • {forecast.wind_wave_direction}
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
                {forecast.water_temp}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Air Temp</p>
              <p className="font-medium flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-orange-500" />
                {forecast.air_temperature}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wind</p>
              <p className="font-medium flex items-center gap-1">
                <Wind className="h-3 w-3 text-gray-600" />
                {forecast.wind_speed}
              </p>
              <p className="text-xs text-muted-foreground">
                {forecast.wind_direction}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conditions</p>
              <p className="font-medium text-sm">
                {forecast.weather_condition}
              </p>
            </div>
          </div>
        </div>

        {/* Tide Information */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            Tides & Currents
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {getTideIcon(forecast.tide_status)}
                <span className="font-medium">{forecast.tide_status}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Current height: {forecast.tide_height}
              </p>
              {forecast.next_tide_type !== "Unknown" && (
                <p className="text-sm text-muted-foreground">
                  Next {forecast.next_tide_type.toLowerCase()}:{" "}
                  {forecast.next_tide_height} at {forecast.next_tide_time}
                </p>
              )}
            </div>

            {forecast.current_speed !== "0 knots" && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-sm mb-1">Tidal Currents</p>
                <p className="text-sm">Speed: {forecast.current_speed}</p>
                <p className="text-sm">
                  Direction: {forecast.current_direction}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quality Indicator */}
        <div className="pt-3 border-t">
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Forecast Reliability</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${getConfidenceIndicatorColor(
                  forecast.confidence_score
                )}`}
              />
              <span>{forecast.confidence_score}% confidence</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
