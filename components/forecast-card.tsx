"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Waves, Wind, Thermometer, Navigation } from "lucide-react";
import { TideDirection } from "@/components/ui/tide-direction";
import { TideTiming } from "@/components/ui/tide-timing";
import { WavePeriodDisplay } from "@/components/ui/wave-period-display";

// Enhanced forecast interface matching the database structure
interface EnhancedForecast {
  id: string;
  forecast_date: string;
  forecast_time: string;
  wave_height: string | null;
  wave_period: string | null;
  wave_direction: string | null;
  swell_1_height: string | null;
  swell_1_period: string | null;
  swell_1_direction: string | null;
  swell_2_height: string | null;
  swell_2_period: string | null;
  swell_2_direction: string | null;
  wind_wave_height: string | null;
  wind_wave_period: string | null;
  wind_wave_direction: string | null;
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
  created_at: string;
  updated_at: string;
}

// Basic props for backward compatibility (homepage usage)
interface BasicForecastCardProps {
  day: string;
  date: string;
  waveHeight: string;
  windSpeed: string;
  waterTemp?: string;
  waveDirection?: string;
  icon?: "wave" | "wind" | "temp";
  forecast?: never;
  variant?: never;
  showDate?: never;
  showBeachName?: never;
}

// Enhanced props for beach detail page usage
interface EnhancedForecastCardProps {
  forecast: EnhancedForecast;
  variant?: "compact" | "detailed";
  showDate?: boolean;
  showBeachName?: boolean;
  day?: never;
  date?: never;
  waveHeight?: never;
  windSpeed?: never;
  waterTemp?: never;
  waveDirection?: never;
  icon?: never;
}

type ForecastCardProps = BasicForecastCardProps | EnhancedForecastCardProps;

export function ForecastCard(props: ForecastCardProps) {
  // Determine if this is enhanced forecast or basic props
  const isEnhanced = "forecast" in props && props.forecast;

  let day: string;
  let date: string;
  let waveHeight: string;
  let windSpeed: string;
  let waterTemp: string | undefined;
  let waveDirection: string | undefined;
  let enhancedForecast: EnhancedForecast | undefined;

  if (isEnhanced) {
    const {
      forecast,
      variant = "compact",
      showDate = true,
      showBeachName = false,
    } = props;

    // Store the forecast for later use
    enhancedForecast = forecast;

    // Extract data from enhanced forecast
    const forecastDate = new Date(forecast.forecast_date);
    const forecastTime = forecast.forecast_time;

    // Check if this forecast date is actually today
    const isForecastDateToday =
      forecastDate.toDateString() === new Date().toDateString();

    // Format day and date
    if (showDate) {
      day = forecastDate.toLocaleDateString("en-US", { weekday: "short" });
      date = forecastDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      // Add time if available
      if (forecastTime) {
        const [hours, minutes] = forecastTime.split(":").map(Number);
        const timeString = new Date(
          2024,
          0,
          1,
          hours,
          minutes
        ).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        date = `${date} ${timeString}`;
      }
    } else {
      // Only show "Today" if the forecast date is actually today
      day = isForecastDateToday
        ? "Today"
        : forecastDate.toLocaleDateString("en-US", { weekday: "short" });
      date = forecastDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }

    // Extract forecast values
    waveHeight = forecast.wave_height || "No data";
    windSpeed = forecast.wind_speed || "No data";
    waterTemp = forecast.water_temp || undefined;
    waveDirection = forecast.wave_direction || undefined;
  } else {
    // Use basic props directly
    day = props.day;
    date = props.date;
    waveHeight = props.waveHeight;
    windSpeed = props.windSpeed;
    waterTemp = props.waterTemp;
    waveDirection = props.waveDirection;
  }

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/90 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Day and Date Header */}
          <div className="text-center pb-2 border-b border-gray-100">
            <p className="font-roboto font-semibold text-dark-grey text-lg">
              {day}
            </p>
            <p className="text-sm text-gray-600 font-open-sans">{date}</p>
          </div>

          {/* Wave Information - Primary */}
          <div className="flex justify-center">
            <WavePeriodDisplay
              waveHeight={waveHeight}
              wavePeriod={
                isEnhanced ? enhancedForecast?.wave_period : undefined
              }
              waveDirection={waveDirection}
              variant="compact"
            />
          </div>

          {/* Tide Information Grid - Enhanced Layout */}
          {isEnhanced && enhancedForecast && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-2">
              <div className="flex justify-center">
                <TideDirection
                  status={enhancedForecast.tide_status}
                  currentHeight={enhancedForecast.tide_height}
                  variant="compact"
                />
              </div>
              <div className="flex justify-center">
                <TideTiming
                  nextTideTime={enhancedForecast.next_tide_time}
                  nextTideType={enhancedForecast.next_tide_type}
                  nextTideHeight={enhancedForecast.next_tide_height}
                  variant="compact"
                />
              </div>
            </div>
          )}

          {/* Weather & Conditions Row */}
          <div className="grid grid-cols-2 gap-4 px-2">
            <div className="flex flex-col items-center text-center">
              <Wind className="h-5 w-5 text-gray-600 mb-1" />
              <p className="text-sm font-semibold text-dark-grey font-montserrat">
                {windSpeed}
              </p>
              <p className="text-xs text-gray-600 font-open-sans">Wind</p>
            </div>

            {waterTemp ? (
              <div className="flex flex-col items-center text-center">
                <Thermometer className="h-5 w-5 text-green-600 mb-1" />
                <p className="text-sm font-semibold text-dark-grey font-montserrat">
                  {waterTemp}
                </p>
                <p className="text-xs text-gray-600 font-open-sans">Water</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="h-5 w-5 mb-1 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                </div>
                <p className="text-sm font-semibold text-gray-400 font-montserrat">
                  N/A
                </p>
                <p className="text-xs text-gray-600 font-open-sans">Water</p>
              </div>
            )}
          </div>

          {/* Confidence Score Row - Enhanced forecast only */}
          {isEnhanced && enhancedForecast?.confidence_score && (
            <div className="flex justify-center px-2">
              <div className="flex flex-col items-center text-center">
                <div className="h-5 w-5 mb-1 flex items-center justify-center">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      enhancedForecast.confidence_score >= 80
                        ? "bg-green-500"
                        : enhancedForecast.confidence_score >= 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  />
                </div>
                <p className="text-sm font-semibold text-dark-grey font-montserrat">
                  {enhancedForecast.confidence_score}%
                </p>
                <p className="text-xs text-gray-600 font-open-sans">
                  Confidence
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ForecastCard;

// New component for grouped forecast display
interface GroupedForecastCardProps {
  direction: string;
  timeRange: string;
  count: number;
  representative: any; // Use any for now to avoid complex type issues
  variant?: "compact" | "detailed";
}

export function GroupedForecastCard({
  direction,
  timeRange,
  count,
  representative,
  variant = "compact",
}: GroupedForecastCardProps) {
  const waveHeight = representative.wave_height || "No data";
  const windSpeed = representative.wind_speed || "No data";
  const waterTemp = representative.water_temp;
  const waveDirection = representative.wave_direction;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/90 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Direction Header */}
          <div className="text-center pb-2 border-b border-gray-100">
            <p className="font-roboto font-bold text-lg text-blue-600">
              {direction}
            </p>
            <p className="text-xs text-gray-500 font-open-sans">
              {timeRange}
              {count > 1 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                  {count}
                </span>
              )}
            </p>
          </div>

          {/* Conditions Row */}
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col items-center text-center min-w-[60px]">
              <Waves className="h-5 w-5 text-ocean-blue mb-1" />
              <p className="text-md font-bold text-ocean-blue font-montserrat">
                {waveHeight}
              </p>
              <p className="text-xs text-gray-600 font-open-sans">Waves</p>
            </div>
            <div className="flex flex-col items-center text-center min-w-[60px]">
              <Wind className="h-5 w-5 text-gray-600 mb-1" />
              <p className="text-md font-semibold text-dark-grey font-montserrat">
                {windSpeed}
              </p>
              <p className="text-xs text-gray-600 font-open-sans">Wind</p>
            </div>
            {waveDirection && (
              <div className="flex flex-col items-center text-center min-w-[60px]">
                <Navigation className="h-5 w-5 text-blue-500 mb-1" />
                <p className="text-sm font-semibold text-dark-grey font-montserrat">
                  {waveDirection}
                </p>
                <p className="text-xs text-gray-600 font-open-sans">Wave Dir</p>
              </div>
            )}
            {waterTemp && (
              <div className="flex flex-col items-center text-center min-w-[60px]">
                <Thermometer className="h-5 w-5 text-green-600 mb-1" />
                <p className="text-sm font-semibold text-dark-grey font-montserrat">
                  {waterTemp}
                </p>
                <p className="text-xs text-gray-600 font-open-sans">Water</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// New component for swell-grouped forecast display
interface GroupedSwellForecastCardProps {
  direction: string;
  timeRange: string;
  count: number;
  swellType: "primary" | "secondary" | "mixed";
  representative: any;
  variant?: "compact" | "detailed";
}

export function GroupedSwellForecastCard({
  direction,
  timeRange,
  count,
  swellType,
  representative,
  variant = "compact",
}: GroupedSwellForecastCardProps) {
  // Get swell information based on type
  let swellHeight = "";
  let swellPeriod = "";

  if (swellType === "primary" && representative.swell_1_height) {
    swellHeight = representative.swell_1_height;
    swellPeriod = representative.swell_1_period || "";
  } else if (swellType === "secondary" && representative.swell_2_height) {
    swellHeight = representative.swell_2_height;
    swellPeriod = representative.swell_2_period || "";
  } else {
    swellHeight = representative.wave_height || "No data";
    swellPeriod = representative.wave_period || "";
  }

  const windSpeed = representative.wind_speed || "No data";
  const waterTemp = representative.water_temp;

  // Get swell type indicator color
  const getSwellTypeColor = (type: string) => {
    switch (type) {
      case "primary":
        return "bg-blue-500 text-white";
      case "secondary":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getSwellTypeLabel = (type: string) => {
    switch (type) {
      case "primary":
        return "Primary";
      case "secondary":
        return "Secondary";
      default:
        return "Mixed";
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/90 backdrop-blur-sm">
      <CardContent className="p-4 text-center">
        <div className="flex flex-col items-center space-y-3">
          {/* Swell Direction Header */}
          <div className="text-center">
            <p className="font-roboto font-bold text-lg text-blue-600">
              {direction}
            </p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-xs text-gray-500 font-open-sans">
                {timeRange}
                {count > 1 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    {count}
                  </span>
                )}
              </p>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSwellTypeColor(
                  swellType
                )}`}
              >
                {getSwellTypeLabel(swellType)}
              </span>
            </div>
          </div>

          {/* Conditions Row */}
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col items-center text-center">
              <Waves className="h-5 w-5 text-ocean-blue mb-1" />
              <p className="text-md font-bold text-ocean-blue font-montserrat">
                {swellHeight}
              </p>
              <p className="text-xs text-gray-600 font-open-sans">
                {swellPeriod ? `${swellPeriod} Swell` : "Swell"}
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Wind className="h-5 w-5 text-gray-600 mb-1" />
              <p className="text-md font-semibold text-dark-grey font-montserrat">
                {windSpeed}
              </p>
              <p className="text-xs text-gray-600 font-open-sans">Wind</p>
            </div>
            {waterTemp && (
              <div className="flex flex-col items-center text-center">
                <Thermometer className="h-5 w-5 text-green-600 mb-1" />
                <p className="text-sm font-semibold text-dark-grey font-montserrat">
                  {waterTemp}
                </p>
                <p className="text-xs text-gray-600 font-open-sans">Water</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
