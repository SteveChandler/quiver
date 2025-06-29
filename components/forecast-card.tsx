"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Waves, Wind, Thermometer, Navigation } from "lucide-react";

interface ForecastCardProps {
  day: string;
  date: string;
  waveHeight: string;
  windSpeed: string;
  waterTemp?: string;
  waveDirection?: string;
  icon?: "wave" | "wind" | "temp";
}

export function ForecastCard({
  day,
  date,
  waveHeight,
  windSpeed,
  waterTemp,
  waveDirection,
  icon = "wave",
}: ForecastCardProps) {
  const IconComponent = {
    wave: Waves,
    wind: Wind,
    temp: Thermometer,
  }[icon];

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/90 backdrop-blur-sm">
      <CardContent className="p-4 text-center">
        <div className="flex flex-col items-center space-y-4">
          {/* Day and Date Section */}
          <div className="text-center">
            <p className="font-roboto font-semibold text-dark-grey">{day}</p>
            <p className="text-sm text-gray-600 font-open-sans">{date}</p>
          </div>

          {/* Conditions Row */}
          <div className="flex items-center justify-center gap-4 md:gap-6">
            <div className="flex flex-col items-center text-center">
              <Waves className="h-6 w-6 text-ocean-blue mb-1" />
              <p className="text-lg font-bold text-ocean-blue font-montserrat">
                {waveHeight}
              </p>
              <p className="text-sm text-gray-600 font-open-sans">High</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Wind className="h-6 w-6 text-gray-600 mb-1" />
              <p className="text-md font-semibold text-dark-grey font-montserrat">
                {windSpeed}
              </p>
              <p className="text-sm text-gray-600 font-open-sans">Wind</p>
            </div>
            {waveDirection && (
              <div className="flex flex-col items-center text-center">
                <Navigation className="h-6 w-6 text-blue-500 mb-1" />
                <p className="text-md font-semibold text-dark-grey font-montserrat">
                  {waveDirection}
                </p>
                <p className="text-sm text-gray-600 font-open-sans">
                  Direction
                </p>
              </div>
            )}
            {waterTemp && (
              <div className="flex flex-col items-center text-center">
                <Thermometer className="h-6 w-6 text-green-600 mb-1" />
                <p className="text-md font-semibold text-dark-grey font-montserrat">
                  {waterTemp}
                </p>
                <p className="text-sm text-gray-600 font-open-sans">Water</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ForecastCard;
