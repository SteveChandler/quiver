import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves, MapPin } from "lucide-react";
import {
  TemperatureMeasurement,
  WindMeasurement,
  WaveMeasurement,
  PressureMeasurement,
} from "./measurement-display";
import {
  BuoyStatusIndicator,
  WaveQualityBadge,
  DataFreshnessIndicator,
} from "./status-indicators";
import { TidesDisplay, NextTide } from "./tides-display";
import { cn } from "@/lib/utils";

interface BuoyConditionsData {
  water_temperature?: number;
  air_temperature?: number;
  wind_speed?: number;
  wind_direction?: number;
  wind_direction_name?: string;
  wind_gust?: number;
  wave_height?: number;
  wave_period?: number;
  pressure?: number;
  tides?: Array<{
    time: number;
    height: number;
    name: string;
  }>;
  updated_at?: number;
}

interface BuoyCardProps {
  buoyId?: string;
  buoyName?: string;
  location?: string;
  conditions?: BuoyConditionsData;
  variant?: "default" | "compact" | "detailed";
  showStatus?: boolean;
  showLocation?: boolean;
  className?: string;
  onClick?: () => void;
}

export function BuoyCard({
  buoyId,
  buoyName = "Weather Buoy",
  location,
  conditions,
  variant = "default",
  showStatus = true,
  showLocation = true,
  className,
  onClick,
}: BuoyCardProps) {
  const isClickable = !!onClick;

  if (variant === "compact") {
    return (
      <Card
        className={cn(
          "transition-shadow",
          isClickable && "cursor-pointer hover:shadow-md",
          className
        )}
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">{buoyName}</span>
              </div>
              {conditions?.wave_height && (
                <WaveQualityBadge waveHeight={conditions.wave_height} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {conditions?.water_temperature && (
                <TemperatureMeasurement
                  value={conditions.water_temperature}
                  type="water"
                  variant="compact"
                />
              )}
              {conditions?.wave_height && (
                <WaveMeasurement
                  height={conditions.wave_height}
                  period={conditions.wave_period}
                  variant="compact"
                />
              )}
            </div>

            {showStatus && conditions?.updated_at && (
              <DataFreshnessIndicator
                timestamp={new Date(conditions.updated_at * 1000)}
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "detailed") {
    return (
      <Card
        className={cn(
          "transition-shadow",
          isClickable && "cursor-pointer hover:shadow-md",
          className
        )}
        onClick={onClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium">{buoyName}</div>
                {buoyId && (
                  <div className="text-sm text-muted-foreground font-normal">
                    Buoy {buoyId}
                  </div>
                )}
              </div>
            </CardTitle>
            {conditions?.wave_height && (
              <WaveQualityBadge waveHeight={conditions.wave_height} />
            )}
          </div>

          {showLocation && location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{location}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Temperature Section */}
          {(conditions?.water_temperature || conditions?.air_temperature) && (
            <div className="grid grid-cols-2 gap-4">
              {conditions.water_temperature && (
                <TemperatureMeasurement
                  value={conditions.water_temperature}
                  type="water"
                />
              )}
              {conditions.air_temperature && (
                <TemperatureMeasurement
                  value={conditions.air_temperature}
                  type="air"
                />
              )}
            </div>
          )}

          {/* Wind Section */}
          {conditions?.wind_speed && (
            <WindMeasurement
              speed={conditions.wind_speed}
              direction={conditions.wind_direction_name}
              gust={conditions.wind_gust}
            />
          )}

          {/* Wave Section */}
          {conditions?.wave_height && (
            <WaveMeasurement
              height={conditions.wave_height}
              period={conditions.wave_period}
            />
          )}

          {/* Pressure */}
          {conditions?.pressure && (
            <PressureMeasurement value={conditions.pressure} />
          )}

          {/* Tides Section */}
          {conditions?.tides && conditions.tides.length > 0 && (
            <div className="space-y-2">
              <NextTide tides={conditions.tides} />
              <TidesDisplay tides={conditions.tides} />
            </div>
          )}

          {/* Status */}
          {showStatus && conditions?.updated_at && (
            <div className="pt-2 border-t">
              <DataFreshnessIndicator
                timestamp={new Date(conditions.updated_at * 1000)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card
      className={cn(
        "transition-shadow",
        isClickable && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Waves className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <div>{buoyName}</div>
            {showLocation && location && (
              <div className="text-sm text-muted-foreground font-normal">
                {location}
              </div>
            )}
          </div>
          {conditions?.wave_height && (
            <WaveQualityBadge waveHeight={conditions.wave_height} />
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Main measurements */}
        <div className="grid grid-cols-2 gap-3">
          {conditions?.water_temperature && (
            <TemperatureMeasurement
              value={conditions.water_temperature}
              type="water"
            />
          )}
          {conditions?.air_temperature && (
            <TemperatureMeasurement
              value={conditions.air_temperature}
              type="air"
            />
          )}
        </div>

        {conditions?.wind_speed && (
          <WindMeasurement
            speed={conditions.wind_speed}
            direction={conditions.wind_direction_name}
            gust={conditions.wind_gust}
          />
        )}

        {conditions?.wave_height && (
          <WaveMeasurement
            height={conditions.wave_height}
            period={conditions.wave_period}
          />
        )}

        {/* Quick tide info */}
        {conditions?.tides && conditions.tides.length > 0 && (
          <NextTide tides={conditions.tides} />
        )}

        {/* Status */}
        {showStatus && conditions?.updated_at && (
          <DataFreshnessIndicator
            timestamp={new Date(conditions.updated_at * 1000)}
          />
        )}
      </CardContent>
    </Card>
  );
}
