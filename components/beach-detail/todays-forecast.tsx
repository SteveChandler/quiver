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
          day="Today"
          date={new Date(forecast.forecast_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
          waveHeight={forecast.wave_height || "No data"}
          windSpeed={forecast.wind_speed}
          waterTemp={forecast.water_temp}
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
