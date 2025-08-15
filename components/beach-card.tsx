"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Star } from "lucide-react";
import Link from "next/link";
import { MapImage } from "@/components/map-image";
import { useForecastPreview } from "@/hooks/use-forecast-preview";
import { ForecastPreview } from "@/components/ui/forecast-preview";

interface BeachCardProps {
  id?: string;
  name: string;
  distance: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  latitude?: number;
  longitude?: number;
  onViewDetails?: () => void;
  onMapClick?: () => void;
  onReviewsClick?: () => void;
  showForecastPreview?: boolean;
}

export function BeachCard({
  id,
  name,
  distance,
  rating,
  reviewCount,
  imageUrl,
  latitude,
  longitude,
  onViewDetails,
  onMapClick,
  onReviewsClick,
  showForecastPreview = false,
}: BeachCardProps) {
  // Use shared forecast preview hook
  const {
    forecastPreview,
    loading: loadingForecast,
    error: forecastError,
  } = useForecastPreview({
    enabled: showForecastPreview,
    beachId: id,
  });

  const handleMapClick = () => {
    if (onMapClick) {
      onMapClick();
    } else if (id) {
      // Default behavior - navigate to beach details
      window.location.href = `/beach/${id}`;
    }
  };

  const handleReviewsClick = () => {
    if (onReviewsClick) {
      onReviewsClick();
    } else if (id) {
      // Default behavior - navigate to beach details reviews tab
      window.location.href = `/beach/${id}?tab=reviews`;
    }
  };

  return (
    <Card className="overflow-hidden" data-testid="beach-card">
      <div className="relative h-48 cursor-pointer" onClick={handleMapClick}>
        <MapImage
          src={imageUrl || "/placeholder.svg"}
          alt={name}
          latitude={latitude}
          longitude={longitude}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 p-3 text-white">
          <h3 className="font-semibold text-lg">{name}</h3>
          <div className="flex items-center text-sm">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{distance}</span>
          </div>
        </div>
      </div>
      <CardContent className="p-3">
        <div className="flex justify-between items-center">
          <div
            className="flex items-center cursor-pointer"
            onClick={handleReviewsClick}
          >
            <Star className="h-4 w-4 text-yellow-500 mr-1 fill-yellow-500" />
            <span className="font-medium">
              {Number.isFinite(rating) ? (rating as number).toFixed(1) : "--"}
            </span>
            <span className="text-muted-foreground text-sm ml-1">
              ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
            </span>
          </div>
          {id ? (
            <Link
              href={`/beach/${id}`}
              className="text-primary text-sm font-medium"
            >
              View Details
            </Link>
          ) : (
            <button
              onClick={onViewDetails}
              className="text-primary text-sm font-medium"
            >
              View Details
            </button>
          )}
        </div>

        {/* Forecast Preview */}
        {showForecastPreview && (
          <div className="mt-3 pt-3 border-t">
            <ForecastPreview
              forecastPreview={forecastPreview}
              loading={loadingForecast}
              error={forecastError}
              variant="grid"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
