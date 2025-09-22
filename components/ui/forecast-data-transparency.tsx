"use client";

import React from "react";
import { AlertCircle, CheckCircle, Wifi, WifiOff, Waves } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface ForecastDataTransparencyProps {
  dataSource: "NOAA_NWS" | "CDIP" | "FALLBACK";
  className?: string;
}

export default function ForecastDataTransparency({
  dataSource,
  className = "",
}: ForecastDataTransparencyProps) {
  const isRealData = dataSource === "NOAA_NWS" || dataSource === "CDIP";

  return (
    <Alert
      className={`${className} ${
        isRealData
          ? "border-green-500/20 bg-green-500/10"
          : "border-orange-500/20 bg-orange-500/10"
      }`}
    >
      <div className="flex items-center gap-2">
        {isRealData ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-orange-600" />
        )}

        <Badge
          variant={isRealData ? "default" : "secondary"}
          className={`text-xs ${
            isRealData
              ? "bg-green-100 text-green-800"
              : "bg-orange-100 text-orange-800"
          }`}
        >
          {isRealData ? (
            <div className="flex items-center gap-1">
              <Waves className="h-3 w-3" />
              Real Wave Data
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              Estimated Conditions
            </div>
          )}
        </Badge>

        <AlertDescription className="text-sm text-foreground">
          {isRealData ? (
            <>
              This forecast uses <strong>real oceanographic data</strong> from
              NOAA WaveWatch III and observational buoys.
            </>
          ) : (
            <>
              <strong>⚠️ Using estimated wave conditions</strong> based on
              location and seasonal patterns. For accurate surf forecasting,
              compare with specialized surf forecast services.
            </>
          )}
        </AlertDescription>
      </div>

      {!isRealData && (
        <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
          <strong>Note:</strong> NOAA weather stations don’t provide
          oceanographic wave data for coastal locations. These estimates are
          based on typical surf conditions for this area and season.
        </div>
      )}
    </Alert>
  );
}
