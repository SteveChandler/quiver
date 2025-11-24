"use client";

import Link from "next/link";
import { ExternalLink, Waves, Wind, Thermometer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionWrapper } from "./section-wrapper";
import { CONTENT } from "@/lib/constants/features";

// Generate dynamic forecast data for landing page
const generateForecastData = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getDayName = (date: Date) => {
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  return [
    {
      day: "Today",
      date: formatDate(today),
      waveHeight: "3-4 ft",
      windSpeed: "4 mph",
      waterTemp: "65°F",
      conditions: "Good",
    },
    {
      day: "Tomorrow",
      date: formatDate(tomorrow),
      waveHeight: "5-6 ft",
      windSpeed: "18 mph",
      waterTemp: "64°F",
      conditions: "Excellent",
    },
    {
      day: getDayName(dayAfter),
      date: formatDate(dayAfter),
      waveHeight: "2-3 ft",
      windSpeed: "12 mph",
      waterTemp: "65°F",
      conditions: "Fair",
    },
  ];
};

const MODERN_FORECAST_DATA = generateForecastData();

function ModernForecastCard({
  day,
  date,
  waveHeight,
  windSpeed,
  waterTemp,
  conditions,
}: {
  day: string;
  date: string;
  waveHeight: string;
  windSpeed: string;
  waterTemp: string;
  conditions: string;
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="text-center mb-4">
          <h3 className="font-semibold text-lg text-gray-900">{day}</h3>
          <p className="text-sm text-gray-600">{date}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Waves</span>
            </div>
            <span className="text-sm font-semibold text-blue-600">
              {waveHeight}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Wind</span>
            </div>
            <span className="text-sm">{windSpeed}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Water</span>
            </div>
            <span className="text-sm">{waterTemp}</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t">
          <div className="text-center">
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                conditions === "Excellent"
                  ? "bg-green-100 text-green-800"
                  : conditions === "Good"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {conditions}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ForecastSection() {
  return (
    <SectionWrapper
      className="py-20 px-4 bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 relative"
      title={CONTENT.sections.forecast.title}
      subtitle={CONTENT.sections.forecast.subtitle}
      maxWidth="6xl"
      centerContent
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-ocean-blue/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {MODERN_FORECAST_DATA.map((forecast, index) => (
            <div
              key={index}
              className="transform hover:scale-105 transition-transform duration-300 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <ModernForecastCard {...forecast} />
            </div>
          ))}
        </div>

        {/* Enhanced CTA */}
        <div
          className="text-center animate-fade-in-up"
          style={{ animationDelay: "400ms" }}
        >
          <p className="text-gray-600 mb-4 text-lg">
            Want personalized forecasts for your favorite spots?
          </p>
          <Link
            href="/auth/sign-up"
            className="inline-flex items-center gap-2 bg-ocean-blue text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-ocean-blue/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            {CONTENT.sections.forecast.link}
            <ExternalLink className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </SectionWrapper>
  );
}
