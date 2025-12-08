"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { X } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface DetailedSwellModalProps {
  forecast: EnhancedForecastEntity | null;
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
}

export function DetailedSwellModal({
  forecast,
  isOpen,
  onClose,
  selectedDate,
}: DetailedSwellModalProps) {
  if (!forecast || !selectedDate) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-ocean-blue to-blue-700 text-white rounded-t-lg -m-6 mb-6 p-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl md:text-2xl font-roboto font-bold">
              Detailed Forecast - {formatDate(selectedDate)}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Forecast Details */}
          <Card className="bg-gradient-to-br from-white to-blue-50 border-ocean-blue/20">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div className="bg-ocean-blue/10 p-3 rounded-lg border border-ocean-blue/20">
                  <strong className="font-roboto text-ocean-blue">
                    Wave Height:
                  </strong>{" "}
                  <span className="font-open-sans text-ocean-blue/80">
                    {forecast.wave_height || "N/A"}
                  </span>
                </div>
                <div className="bg-ocean-blue/10 p-3 rounded-lg border border-ocean-blue/20">
                  <strong className="font-roboto text-ocean-blue">
                    Wave Period:
                  </strong>{" "}
                  <span className="font-open-sans text-ocean-blue/80">
                    {forecast.wave_period || "N/A"}
                  </span>
                </div>
                <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                  <strong className="font-roboto text-blue-700">
                    Water Temp:
                  </strong>{" "}
                  <span className="font-open-sans text-blue-600">
                    {forecast.water_temp}
                  </span>
                </div>
                <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                  <strong className="font-roboto text-blue-700">
                    Wind Speed:
                  </strong>{" "}
                  <span className="font-open-sans text-blue-600">
                    {forecast.wind_speed}
                  </span>
                </div>
                <div className="bg-cyan-50/70 p-3 rounded-lg border border-cyan-200">
                  <strong className="font-roboto text-cyan-700">
                    Wind Dir:
                  </strong>{" "}
                  <span className="font-open-sans text-cyan-600">
                    {forecast.wind_direction}
                  </span>
                </div>
                <div className="bg-cyan-50/70 p-3 rounded-lg border border-cyan-200">
                  <strong className="font-roboto text-cyan-700">
                    Condition:
                  </strong>{" "}
                  <span className="font-open-sans text-cyan-600">
                    {forecast.weather_condition}
                  </span>
                </div>
                <div className="bg-teal-50/70 p-3 rounded-lg border border-teal-200">
                  <strong className="font-roboto text-teal-700">
                    Tide Status:
                  </strong>{" "}
                  <span className="font-open-sans text-teal-600">
                    {forecast.tide_status}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                  <strong className="font-roboto text-emerald-700">
                    Confidence:
                  </strong>{" "}
                  <span className="font-open-sans text-emerald-600">
                    {Math.round(forecast.confidence_score ?? 0)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Swell Information */}
          <Card className="bg-gradient-to-br from-white to-blue-50 border-ocean-blue/20">
            <CardContent className="p-6">
              <Accordion type="single" collapsible defaultValue="swells">
                <AccordionItem value="swells" className="border-ocean-blue/20">
                  <AccordionTrigger className="font-roboto text-ocean-blue hover:text-ocean-blue/80 text-lg">
                    Swell & Wind Wave Details
                  </AccordionTrigger>
                  <AccordionContent className="bg-white/60 rounded-lg p-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-ocean-blue/10 p-4 rounded-lg border border-ocean-blue/20">
                        <strong className="font-roboto text-ocean-blue text-lg">
                          Swell 1:
                        </strong>
                        <br />
                        <div className="mt-2 space-y-1">
                          <div className="font-open-sans text-ocean-blue/80">
                            <strong>Height:</strong>{" "}
                            {forecast.swell_1_height || "N/A"}
                          </div>
                          <div className="font-open-sans text-ocean-blue/80">
                            <strong>Period:</strong>{" "}
                            {forecast.swell_1_period || "N/A"}
                          </div>
                          <div className="font-open-sans text-ocean-blue/80">
                            <strong>Direction:</strong>{" "}
                            {forecast.swell_1_direction || "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="bg-blue-50/70 p-4 rounded-lg border border-blue-200">
                        <strong className="font-roboto text-blue-700 text-lg">
                          Swell 2:
                        </strong>
                        <br />
                        <div className="mt-2 space-y-1">
                          <div className="font-open-sans text-blue-600">
                            <strong>Height:</strong>{" "}
                            {forecast.swell_2_height || "N/A"}
                          </div>
                          <div className="font-open-sans text-blue-600">
                            <strong>Period:</strong>{" "}
                            {forecast.swell_2_period || "N/A"}
                          </div>
                          <div className="font-open-sans text-blue-600">
                            <strong>Direction:</strong>{" "}
                            {forecast.swell_2_direction || "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="bg-cyan-50/70 p-4 rounded-lg border border-cyan-200">
                        <strong className="font-roboto text-cyan-700 text-lg">
                          Wind Wave:
                        </strong>
                        <br />
                        <div className="mt-2 space-y-1">
                          <div className="font-open-sans text-cyan-600">
                            <strong>Height:</strong>{" "}
                            {forecast.wind_wave_height || "N/A"}
                          </div>
                          <div className="font-open-sans text-cyan-600">
                            <strong>Period:</strong>{" "}
                            {forecast.wind_wave_period || "N/A"}
                          </div>
                          <div className="font-open-sans text-cyan-600">
                            <strong>Direction:</strong>{" "}
                            {forecast.wind_wave_direction || "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
