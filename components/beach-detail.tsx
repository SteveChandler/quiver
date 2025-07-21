"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface BeachDetailProps {
  id: string;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  tide_height: number;
  next_tide_type: string;
  forecast: EnhancedForecastEntity;
}

export function BeachDetail({ id }: BeachDetailProps) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Single data fetch - 10-day enhanced forecast
  const fetchForecasts = useCallback(async () => {
    console.log("🚀 Starting fresh forecast fetch for beach:", id);
    const result = await getEnhancedBeachForecasts(id, 10);
    if (result.success && result.data) {
      console.log("🔍 Raw forecast data:", {
        totalForecasts: result.data.length,
        dateRange: {
          first: result.data[0]?.forecast_date,
          last: result.data[result.data.length - 1]?.forecast_date,
        },
        sampleForecast: result.data[0],
        uniqueDates: [...new Set(result.data.map((f) => f.forecast_date))],
        forecastsByDate: result.data.reduce((acc, f) => {
          acc[f.forecast_date] = (acc[f.forecast_date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch forecasts");
  }, [id]);

  const {
    data: forecasts,
    loading,
    error,
    refetch,
  } = useDataFetcher(fetchForecasts, {
    immediate: true,
  });

  // Process data for chart
  const chartData: ChartDataPoint[] = [];
  const forecastsByDate: Record<string, EnhancedForecastEntity[]> = {};

  if (forecasts) {
    console.log("📊 Processing forecasts:", {
      totalForecasts: forecasts.length,
      firstForecast: forecasts[0],
    });

    // Group forecasts by date
    forecasts.forEach((forecast) => {
      const date = forecast.forecast_date;
      if (!forecastsByDate[date]) {
        forecastsByDate[date] = [];
      }
      forecastsByDate[date].push(forecast);
    });

    console.log("📅 Grouped forecasts by date:", {
      dates: Object.keys(forecastsByDate),
      forecastsPerDate: Object.entries(forecastsByDate).map(
        ([date, forecasts]) => ({
          date,
          count: forecasts.length,
          firstForecast: forecasts[0]?.wave_height,
        })
      ),
    });

    // Create chart data points (one per day) - take first forecast for each date
    Object.keys(forecastsByDate)
      .sort()
      .forEach((date, dayIndex) => {
        const dayForecasts = forecastsByDate[date];

        if (dayForecasts.length > 0) {
          // Just take the first forecast for this date
          const representative = dayForecasts[0];

          console.log(
            `📊 Day ${dayIndex} (${date}): Using first forecast of ${dayForecasts.length} available`,
            {
              forecast_time: representative.forecast_time,
              wave_height: representative.wave_height,
              tide_height: representative.tide_height,
              weather_condition: representative.weather_condition,
            }
          );

          // Fix date formatting - use simple format to avoid timezone issues
          const dateParts = date.split("-"); // "2025-07-20" -> ["2025", "07", "20"]
          const month = parseInt(dateParts[1]);
          const day = parseInt(dateParts[2]);

          // Get day of week
          const dateObj = new Date(date + "T12:00:00"); // Add time to avoid timezone issues
          const dayName = dateObj.toLocaleDateString("en-US", {
            weekday: "short",
          });

          const displayDate = `${dayName} ${month}/${day}`;

          chartData.push({
            date,
            displayDate,
            tide_height: parseFloat(representative.tide_height) || 0,
            next_tide_type: representative.next_tide_type,
            forecast: representative,
          });
        }
      });

    console.log("📈 Chart data created:", {
      chartPoints: chartData.length,
      dates: chartData.map((c) => c.displayDate),
      tideHeights: chartData.map((c) => c.tide_height),
      waveHeights: chartData.map((c) => c.forecast.wave_height),
    });
  }

  const selectedDayData = selectedDay ? forecastsByDate[selectedDay] : null;
  const selectedDayForecast = selectedDayData?.[0];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !forecasts) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">
            {error || "Beach forecast not found"}
          </h2>
          <Button onClick={() => router.push("/map")}>Back to Map</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center h-16 px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/map")}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Beach Details</h1>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <h1 className="text-3xl font-extrabold mb-6 text-center">
          Beach Details
        </h1>

        {/* Debug Info */}
        <div className="mb-4 p-3 bg-blue-100 rounded text-sm">
          <div className="flex items-center justify-between">
            <div>
              <strong>Debug Info:</strong> Found {forecasts?.length || 0}{" "}
              forecasts,
              {chartData.length} days, Today:{" "}
              {new Date().toISOString().split("T")[0]}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                console.log("🔄 Force refreshing forecasts...");
                refetch();
              }}
            >
              Force Refresh
            </Button>
          </div>
        </div>

        {/* Tide Chart for 10 days */}
        <div className="w-full h-72 mb-8 bg-white rounded-2xl shadow-lg p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              onClick={(data) => {
                if (data && data.activeLabel) {
                  const clickedPoint = chartData.find(
                    (p) => p.displayDate === data.activeLabel
                  );
                  if (clickedPoint) {
                    setSelectedDay(
                      selectedDay === clickedPoint.date
                        ? null
                        : clickedPoint.date
                    );
                  }
                }
              }}
            >
              <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{
                  value: "Tide Height (ft)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                formatter={(value, name) => [`${value} ft`, "Tide Height"]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="tide_height"
                stroke="#4A5568"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload) return null;

                  const color =
                    payload.next_tide_type === "H" ? "#0077B6" : "#FF7F11";
                  const isSelected = selectedDay === payload.date;

                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 8 : 5}
                      fill={color}
                      stroke={isSelected ? "#000" : "none"}
                      strokeWidth={isSelected ? 2 : 0}
                      style={{ cursor: "pointer" }}
                    />
                  );
                }}
                activeDot={{ r: 8, stroke: "#000", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Today's Overview (First Day) */}
        {chartData.length > 0 && (
          <Card className="rounded-2xl shadow-lg mb-8 bg-white">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                {chartData[0].displayDate} Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <strong>Wave Height:</strong>{" "}
                  {chartData[0].forecast.wave_height || "N/A"}
                </div>
                <div>
                  <strong>Wave Period:</strong>{" "}
                  {chartData[0].forecast.wave_period || "N/A"}
                </div>
                <div>
                  <strong>Water Temp:</strong>{" "}
                  {chartData[0].forecast.water_temp}°F
                </div>
                <div>
                  <strong>Wind Speed:</strong>{" "}
                  {chartData[0].forecast.wind_speed}
                </div>
                <div>
                  <strong>Wind Dir:</strong>{" "}
                  {chartData[0].forecast.wind_direction}
                </div>
                <div>
                  <strong>Condition:</strong>{" "}
                  {chartData[0].forecast.weather_condition}
                </div>
                <div>
                  <strong>Tide Status:</strong>{" "}
                  {chartData[0].forecast.tide_status}
                </div>
                <div>
                  <strong>Confidence:</strong>{" "}
                  {Math.round(chartData[0].forecast.confidence_score)}%
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Day Detail */}
        {selectedDay && selectedDayForecast && (
          <Card className="rounded-2xl shadow-lg mb-8 bg-blue-50 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center justify-between">
                {chartData.find((d) => d.date === selectedDay)?.displayDate} -
                Detailed Forecast
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDay(null)}
                >
                  Close
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <strong>Wave Height:</strong>{" "}
                  {selectedDayForecast.wave_height || "N/A"}
                </div>
                <div>
                  <strong>Wave Period:</strong>{" "}
                  {selectedDayForecast.wave_period || "N/A"}
                </div>
                <div>
                  <strong>Water Temp:</strong> {selectedDayForecast.water_temp}
                  °F
                </div>
                <div>
                  <strong>Wind Speed:</strong> {selectedDayForecast.wind_speed}
                </div>
                <div>
                  <strong>Wind Dir:</strong>{" "}
                  {selectedDayForecast.wind_direction}
                </div>
                <div>
                  <strong>Condition:</strong>{" "}
                  {selectedDayForecast.weather_condition}
                </div>
                <div>
                  <strong>Tide Status:</strong>{" "}
                  {selectedDayForecast.tide_status}
                </div>
                <div>
                  <strong>Confidence:</strong>{" "}
                  {Math.round(selectedDayForecast.confidence_score)}%
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="swells">
                  <AccordionTrigger>Swell & Wind Wave Details</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <strong>Swell 1:</strong>
                        <br />
                        Height: {selectedDayForecast.swell_1_height || "N/A"}
                        <br />
                        Period: {selectedDayForecast.swell_1_period || "N/A"}
                        <br />
                        Dir: {selectedDayForecast.swell_1_direction || "N/A"}
                      </div>
                      <div>
                        <strong>Swell 2:</strong>
                        <br />
                        Height: {selectedDayForecast.swell_2_height || "N/A"}
                        <br />
                        Period: {selectedDayForecast.swell_2_period || "N/A"}
                        <br />
                        Dir: {selectedDayForecast.swell_2_direction || "N/A"}
                      </div>
                      <div>
                        <strong>Wind Wave:</strong>
                        <br />
                        Height: {selectedDayForecast.wind_wave_height || "N/A"}
                        <br />
                        Period: {selectedDayForecast.wind_wave_period || "N/A"}
                        <br />
                        Dir: {selectedDayForecast.wind_wave_direction || "N/A"}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Remaining Days - Static Cards */}
        <div className="space-y-6">
          {chartData.slice(1).map((day) => (
            <Card
              key={day.date}
              className={`rounded-2xl shadow-md bg-white cursor-pointer transition-all hover:shadow-lg ${
                selectedDay === day.date ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() =>
                setSelectedDay(selectedDay === day.date ? null : day.date)
              }
            >
              <CardHeader>
                <CardTitle className="text-lg font-medium">
                  {day.displayDate}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <strong>Wave Height:</strong>{" "}
                    {day.forecast.wave_height || "N/A"}
                  </div>
                  <div>
                    <strong>Wave Period:</strong>{" "}
                    {day.forecast.wave_period || "N/A"}
                  </div>
                  <div>
                    <strong>Water Temp:</strong> {day.forecast.water_temp}°F
                  </div>
                  <div>
                    <strong>Wind Speed:</strong> {day.forecast.wind_speed}
                  </div>
                  <div>
                    <strong>Wind Dir:</strong> {day.forecast.wind_direction}
                  </div>
                  <div>
                    <strong>Condition:</strong> {day.forecast.weather_condition}
                  </div>
                  <div>
                    <strong>Tide Status:</strong> {day.forecast.tide_status}
                  </div>
                  <div>
                    <strong>Confidence:</strong>{" "}
                    {Math.round(day.forecast.confidence_score)}%
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Click to see detailed swell information
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
