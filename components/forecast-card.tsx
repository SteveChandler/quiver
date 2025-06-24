"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Waves, Wind, Thermometer } from "lucide-react";

interface ForecastCardProps {
  day: string;
  date: string;
  waveHeight: string;
  windSpeed: string;
  waterTemp?: string;
  icon?: "wave" | "wind" | "temp";
}

export function ForecastCard({
  day,
  date,
  waveHeight,
  windSpeed,
  waterTemp,
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
        <div className="flex flex-col items-center space-y-2">
          <IconComponent className="h-8 w-8 text-ocean-blue" />
          <div>
            <p className="font-roboto font-semibold text-dark-grey">{day}</p>
            <p className="text-sm text-gray-600 font-open-sans">{date}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-ocean-blue font-montserrat">
              {waveHeight}
            </p>
            <p className="text-sm text-gray-600 font-open-sans">High</p>
          </div>
          <div className="text-center">
            <p className="text-md font-semibold text-dark-grey font-montserrat">
              {windSpeed}
            </p>
            <p className="text-sm text-gray-600 font-open-sans">Wind</p>
          </div>
          {waterTemp && (
            <div className="text-center">
              <p className="text-md font-semibold text-dark-grey font-montserrat">
                {waterTemp}
              </p>
              <p className="text-sm text-gray-600 font-open-sans">Water</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ForecastCard;
