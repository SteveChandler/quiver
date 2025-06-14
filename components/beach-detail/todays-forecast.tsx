import { Card, CardContent } from "@/components/ui/card";
import { ForecastCard } from "@/components/forecast-card";
import { formatForecastTime } from "@/lib/utils";
import type { Forecast } from "@/types/database";

interface TodaysForecastProps {
  forecast: Forecast | undefined;
}

export function TodaysForecast({ forecast }: TodaysForecastProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Today's Forecast</h3>
      {forecast ? (
        <ForecastCard
          beachName={formatForecastTime(
            forecast.forecast_date,
            forecast.forecast_time
          )}
          waveHeight={forecast.wave_height}
          waterTemp={forecast.water_temp}
          windSpeed={forecast.wind_speed}
          tide={forecast.tide || "Unknown"}
          time={formatForecastTime(
            forecast.forecast_date,
            forecast.forecast_time
          )}
          windDirection={forecast.wind_direction || undefined}
          weatherCondition={forecast.weather_condition || undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            No forecast data available for today
          </CardContent>
        </Card>
      )}
    </section>
  );
}
