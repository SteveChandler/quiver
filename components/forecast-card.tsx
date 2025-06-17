import { Card, CardContent } from "@/components/ui/card";
import {
  Waves,
  Thermometer,
  Wind,
  Clock,
  ArrowRight,
  Cloud,
  Droplets,
} from "lucide-react";
import Link from "next/link";

interface ForecastCardProps {
  beachName: string;
  waveHeight: string;
  waterTemp: string;
  windSpeed: string;
  tide: string;
  time: string;
  windDirection?: string;
  weatherCondition?: string;
  beachId?: string;
}

export function ForecastCard({
  beachName,
  waveHeight,
  waterTemp,
  windSpeed,
  tide,
  time,
  windDirection,
  weatherCondition,
  beachId,
}: ForecastCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-primary p-3 text-primary-foreground">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{beachName}</h3>
            <span className="text-sm flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {time}
            </span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Wave Height</p>
                <p className="font-medium">{waveHeight}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Water Temp</p>
                <p className="font-medium">{waterTemp}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Wind</p>
                <p className="font-medium">
                  {windSpeed} {windDirection && `(${windDirection})`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Tide</p>
                <p className="font-medium">{tide}</p>
              </div>
            </div>
          </div>
          {weatherCondition && (
            <div className="flex items-center gap-2 mt-2">
              <Cloud className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Weather</p>
                <p className="font-medium">{weatherCondition}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            {beachId ? (
              <Link
                href={`/beach/${beachId}`}
                className="text-primary flex items-center text-sm font-medium hover:underline"
              >
                View Details <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            ) : (
              <button className="text-primary flex items-center text-sm font-medium opacity-50 cursor-not-allowed">
                View Details <ArrowRight className="ml-1 h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
