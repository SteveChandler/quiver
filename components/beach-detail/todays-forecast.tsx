import { Card, CardContent } from "@/components/ui/card";
import { Waves, Wind, Thermometer, Info } from "lucide-react";
import { formatForecastTime } from "@/lib/utils";
import { AdjustedForecastDisplay } from "@/components/forecast/adjusted-forecast-display";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import type { Forecast } from "@/types/database";

interface TodaysForecastProps {
  forecast: Forecast | undefined;
}

// Modern forecast display component for beach detail page
function ModernForecastDisplay({ forecast }: { forecast: Forecast }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">
            Today's Forecast
          </h3>
          <p className="text-sm text-gray-600">
            {new Date(forecast.forecast_date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="space-y-4">
          {/* Wave Information */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-800">Wave Height</span>
              </div>
              <span className="text-lg font-semibold text-blue-600">
                {forecast.wave_height || "No data"}
              </span>
            </div>
          </div>

          {/* Weather Conditions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-800">Wind</span>
              </div>
              <div className="text-lg font-semibold text-gray-800">
                {forecast.wind_speed}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Thermometer className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-800">Water</span>
              </div>
              <div className="text-lg font-semibold text-gray-800">
                {forecast.water_temp || "No data"}
              </div>
            </div>
          </div>

          {/* Forecast Time */}
          <div className="flex items-center justify-center gap-2 p-3 bg-white border rounded-lg">
            <Info className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Forecast for {formatForecastTime(forecast.forecast_time)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TodaysForecast({ forecast }: TodaysForecastProps) {
  const { beachAccuracy } = useForecastCalibration({
    beachId: forecast?.beach_id,
  });

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Today's Forecast</h3>
      {forecast ? (
        <div className="space-y-4">
          {/* Enhanced forecast with community adjustments */}
          {beachAccuracy && (
            <AdjustedForecastDisplay
              rawForecast={forecast}
              beachAccuracy={beachAccuracy}
              compact={true}
            />
          )}

          {/* Original forecast display */}
          <ModernForecastDisplay forecast={forecast} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>No forecast data available for today</span>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
