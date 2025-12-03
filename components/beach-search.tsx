"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import { beachNavigation } from "@/lib/navigation-utils";
import { TideDirection } from "@/components/ui/tide-direction";
import { TideTiming } from "@/components/ui/tide-timing";
import { WavePeriodDisplay } from "@/components/ui/wave-period-display";
import ForecastDataTransparency from "@/components/ui/forecast-data-transparency";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import { FallbackForecastDisplay } from "@/components/beach/fallback-forecast-display";
import { useBeachForecast } from "@/hooks/use-beach-forecast";
import type { Beach, Profile } from "@/types/database";

interface BeachSearchProps {
  profile?: Profile | null;
}

/**
 * Beach search component that uses enhanced forecast data
 */
export function BeachSearch({ profile }: BeachSearchProps) {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWaitingForProfile, setIsWaitingForProfile] = useState(true);
  const [showFallbackMessage, setShowFallbackMessage] = useState(false);
  const [outOfAreaMessage, setOutOfAreaMessage] = useState<string>("");
  const [isOutOfAreaSearch, setIsOutOfAreaSearch] = useState(false);

  const {
    beach,
    forecast,
    loading,
    error,
    refreshing,
    availableBeaches,
    setBeach,
    setForecast,
    loadAvailableBeaches,
    refreshForecast,
    initializeWithProfile
  } = useBeachForecast();

  // Initialize component based on profile
  useEffect(() => {
    if (isInitialized) return;

    const init = async () => {
      await initializeWithProfile(profile || null);
      setIsWaitingForProfile(false);
      setIsInitialized(true);
    };

    // Add a small delay to prevent flash of loading state
    const timeoutId = setTimeout(init, 100);
    return () => clearTimeout(timeoutId);
  }, [profile, isInitialized, initializeWithProfile]);

  // Reset when profile's home beach changes
  useEffect(() => {
    if (isInitialized) {
      setIsInitialized(false);
      setBeach(null);
      setForecast(null);
      setShowFallbackMessage(false);
      setOutOfAreaMessage("");
      setIsOutOfAreaSearch(false);
    }
  }, [profile?.home_beach_id, isInitialized, setBeach, setForecast]);

  // Load beaches when fallback message is shown
  useEffect(() => {
    if (showFallbackMessage && availableBeaches.length === 0) {
      loadAvailableBeaches();
    }
  }, [showFallbackMessage, availableBeaches.length, loadAvailableBeaches]);

  const handleBeachSelect = (selectedBeach: Beach) => {
    // Navigate to the selected beach page immediately
    beachNavigation.navigateToBeach(router, selectedBeach);
  };

  // Don't show loading state on initial render
  if (isWaitingForProfile) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Loading your forecast...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Available beaches display when showing fallback
  if (showFallbackMessage && availableBeaches.length > 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Available Beaches
            </h3>
            <p className="text-sm text-gray-600">
              Try searching for one of these beaches instead:
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {availableBeaches.map((availableBeach) => (
              <Button
                key={availableBeach.id}
                variant="outline"
                className="text-sm"
                onClick={() => handleBeachSelect(availableBeach)}
              >
                {availableBeach.name}
              </Button>
            ))}
          </div>

          <BeachSearchAutocomplete
            onSelect={handleBeachSelect}
            placeholder="Search for a beach..."
            showCurrentConditions={true}
            className="w-full"
          />
        </CardContent>
      </Card>
    );
  }

  // Out of area search message
  if (isOutOfAreaSearch) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Search Results
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">{outOfAreaMessage}</p>
            </div>
          </div>

          <BeachSearchAutocomplete
            onSelect={handleBeachSelect}
            placeholder="Search for a beach..."
            showCurrentConditions={true}
            className="w-full"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="mb-6">
          <BeachSearchAutocomplete
            onSelect={handleBeachSelect}
            placeholder="Search for a beach..."
            showCurrentConditions={true}
            className="w-full"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading forecast...</p>
          </div>
        )}

        {!loading && beach && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-800">
                {beach.name}
              </h2>
              <div className="text-sm text-gray-600 mt-1">
                {profile?.home_beach_id === beach.id ? (
                  `Showing surf conditions for your favorite beach: ${beach.name}`
                ) : profile?.home_beach_id ? (
                  `Showing surf conditions for ${beach.name}`
                ) : (
                  <div className="space-y-2">
                    <p>Showing surf conditions for {beach.name}</p>
                    <div className="flex items-center justify-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="text-sm text-blue-800">
                        💡 Want to see your home beach here?
                        <button
                          onClick={() => {
                            router.push("/profile?edit=true");
                          }}
                          className="ml-1 text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          Set your home beach
                        </button>
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {getBeachLocation(beach)}
              </div>
            </div>

            {/* Enhanced Forecast Display */}
            {forecast && "forecast_date" in forecast ? (
              <div className="space-y-4">
                {/* Today's Date Header */}
                <div className="text-center pb-3 border-b border-gray-200">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Today’s Forecast
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refreshForecast}
                      disabled={refreshing}
                      className="h-8 w-8 p-0"
                      title="Refresh forecast"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          refreshing ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    {(() => {
                      const [year, month, day] = forecast.forecast_date
                        .split("-")
                        .map(Number);
                      const localDate = new Date(year, month - 1, day);
                      return localDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      });
                    })()}
                  </p>
                </div>

                {/* Wave Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <WavePeriodDisplay
                    waveHeight={forecast.wave_height ?? null}
                    wavePeriod={forecast.wave_period ?? null}
                    waveDirection={forecast.wave_direction ?? null}
                    variant="detailed"
                  />
                </div>

                {/* Tide Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TideDirection
                    status={forecast.tide_status ?? ""}
                    currentHeight={forecast.tide_height ?? undefined}
                    variant="detailed"
                  />
                  <TideTiming
                    nextTideTime={forecast.next_tide_time ?? ""}
                    nextTideType={forecast.next_tide_type ?? ""}
                    nextTideHeight={forecast.next_tide_height ?? undefined}
                    variant="detailed"
                  />
                </div>

                {/* Weather & Conditions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800">
                      {forecast.wind_speed}
                    </div>
                    <div className="text-sm text-gray-600">Wind</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800">
                      {forecast.wind_direction}
                    </div>
                    <div className="text-sm text-gray-600">Direction</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800">
                      {forecast.water_temp}
                    </div>
                    <div className="text-sm text-gray-600">Water</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800">
                      {forecast.air_temperature}
                    </div>
                    <div className="text-sm text-gray-600">Air</div>
                  </div>
                </div>

                {/* Confidence Score */}
                <div className="flex items-center justify-center gap-2 p-3 bg-white border rounded-lg">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      (forecast.confidence_score ?? 0) >= 80
                        ? "bg-green-500"
                        : (forecast.confidence_score ?? 0) >= 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    Forecast Confidence: {forecast.confidence_score ?? 0}%
                  </span>
                </div>

                {/* Swell Components */}
                {(forecast.swell_1_height ||
                  forecast.swell_2_height ||
                  forecast.wind_wave_height) && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-800">
                      Swell Components
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {forecast.swell_1_height && (
                        <div className="flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/20 rounded">
                          <span className="text-sm font-medium text-foreground">
                            Primary Swell
                          </span>
                          <span className="text-sm text-foreground">
                            {forecast.swell_1_height} @{" "}
                            {forecast.swell_1_period || "N/A"}
                            {forecast.swell_1_direction &&
                              ` ${forecast.swell_1_direction}`}
                          </span>
                        </div>
                      )}
                      {forecast.swell_2_height && (
                        <div className="flex items-center justify-between p-2 bg-green-500/10 border border-green-500/20 rounded">
                          <span className="text-sm font-medium text-foreground">
                            Secondary Swell
                          </span>
                          <span className="text-sm text-foreground">
                            {forecast.swell_2_height} @{" "}
                            {forecast.swell_2_period || "N/A"}
                            {forecast.swell_2_direction &&
                              ` ${forecast.swell_2_direction}`}
                          </span>
                        </div>
                      )}
                      {forecast.wind_wave_height && (
                        <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                          <span className="text-sm font-medium">
                            Wind Waves
                          </span>
                          <span className="text-sm">
                            {forecast.wind_wave_height} @{" "}
                            {forecast.wind_wave_period || "N/A"}
                            {forecast.wind_wave_direction &&
                              ` ${forecast.wind_wave_direction}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Data Source Transparency */}
                <div className="mt-4">
                  <ForecastDataTransparency
                    dataSource={(forecast.data_source as "NOAA_NWS" | "CDIP" | "FALLBACK") || "FALLBACK"}
                    className="text-xs"
                  />
                </div>

                {/* Navigation to Beach Details */}
                <div className="flex justify-center pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => {
                      const beachUrl = getBeachUrlSafe(beach);
                      if (beachUrl) router.push(beachUrl);
                    }}
                    className="w-full sm:w-auto"
                    variant="default"
                  >
                    View Beach Details
                  </Button>
                </div>
              </div>
            ) : (
              // Legacy forecast display fallback
              forecast && <FallbackForecastDisplay forecast={forecast} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
