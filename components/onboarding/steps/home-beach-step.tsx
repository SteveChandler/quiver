"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  homeBeachSchema,
  HomeBeachFormData,
} from "@/lib/schemas/onboarding-schemas";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useAuth } from "@/context/auth-context";
import { skipOnboarding } from "@/actions/onboarding-actions";
import { handleOnboardingDismiss } from "../onboarding-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

interface Beach {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  country?: string | null;
}

export function HomeBeachStep() {
  const { data, updateData, nextStep, closeDialog } = useOnboardingStore();
  const { user } = useAuth();
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [query, setQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );

  const {
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<HomeBeachFormData>({
    resolver: zodResolver(homeBeachSchema),
    defaultValues: {
      homeBeachId: data.homeBeachId || "",
      homeBeachName: data.homeBeachName || "",
      homeBeachSlug: data.homeBeachSlug || "",
      homeBeachCity: data.homeBeachCity || "",
      homeBeachState: data.homeBeachState || "",
      homeBeachCountry: data.homeBeachCountry || "",
    },
    mode: "onChange",
  });

  // Keep local selected state in sync when navigating back to this step.
  useEffect(() => {
    if (
      typeof data.homeBeachId === "string" &&
      data.homeBeachId &&
      typeof data.homeBeachName === "string" &&
      data.homeBeachName
    ) {
      const homeBeachId = data.homeBeachId;
      const homeBeachName = data.homeBeachName;
      setSelectedBeach((prev) =>
        prev?.id === homeBeachId
          ? prev
          : { id: homeBeachId, name: homeBeachName }
      );
    }
  }, [data.homeBeachId, data.homeBeachName]);

  const fetchSearchResults = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [] as Beach[];

    const res = await fetch(
      `/api/beaches/search?query=${encodeURIComponent(trimmed)}`
    );
    if (!res.ok) throw new Error(`Beach search failed (HTTP ${res.status})`);
    const result = await res.json();
    return (result?.data || []) as Beach[];
  }, [query]);

  const {
    data: searchResultsData,
    loading: isSearching,
    error: searchError,
    refetch: refetchSearch,
  } = useDataFetcher<Beach[]>(fetchSearchResults, {
    immediate: false,
    skip: query.trim().length < 2,
    initialData: [],
  });

  // Debounce search while typing
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      refetchSearch();
    }, 200);
    return () => clearTimeout(timer);
  }, [query, refetchSearch]);

  const fetchNearbyBeaches = useCallback(async () => {
    if (!coords) return [] as Beach[];
    const res = await fetch(
      `/api/beaches/nearby?lat=${coords.lat}&lon=${coords.lon}&limit=12&maxDistance=30`
    );
    if (!res.ok) throw new Error(`Nearby beaches failed (HTTP ${res.status})`);
    const result = await res.json();
    return (result?.data || []) as Beach[];
  }, [coords]);

  const {
    data: nearbyBeachesData,
    loading: nearbyLoading,
    error: nearbyError,
    refetch: refetchNearby,
  } = useDataFetcher<Beach[]>(fetchNearbyBeaches, {
    immediate: false,
    skip: !coords,
    initialData: [],
  });

  const searchResults = useMemo(
    () => searchResultsData || [],
    [searchResultsData]
  );

  const nearbyBeaches = useMemo(
    () => nearbyBeachesData || [],
    [nearbyBeachesData]
  );

  const [popularBeaches, setPopularBeaches] = useState<Beach[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/beaches/popular?limit=8')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((result) => {
        if (!cancelled) setPopularBeaches(result?.data || []);
      })
      .catch(() => {
        // Non-critical - popular beaches are a nice-to-have
      });
    return () => { cancelled = true; };
  }, []);

  const handleSkipForNow = () => {
    if (user?.id) {
      const result = handleOnboardingDismiss(user.id);
      if (result === 'permanent') {
        skipOnboarding();
      }
    }
    closeDialog();
  };

  const selectBeach = (beach: Beach) => {
    setSelectedBeach(beach);
    setQuery("");
    setValue("homeBeachId", beach.id, { shouldValidate: true });
    setValue("homeBeachName", beach.name, { shouldValidate: true });
    setValue("homeBeachSlug", beach.slug || undefined, { shouldValidate: true });
    setValue("homeBeachCity", beach.city || undefined, { shouldValidate: true });
    setValue("homeBeachState", beach.state || beach.region || undefined, { shouldValidate: true });
    setValue("homeBeachCountry", beach.country || undefined, { shouldValidate: true });

    // Persist selection immediately so the store survives navigation between steps.
    updateData({
      homeBeachId: beach.id,
      homeBeachName: beach.name,
      homeBeachSlug: beach.slug || undefined,
      homeBeachCity: beach.city || undefined,
      homeBeachState: beach.state || beach.region || undefined,
      homeBeachCountry: beach.country || undefined,
    });

    // UX: selecting a beach should immediately advance to the next step
    nextStep();
  };

  const onSubmit = (formData: HomeBeachFormData) => {
    updateData(formData);
    nextStep();
  };

  const handleUseLocation = useCallback(async () => {
    setLocationError(null);
    setIsLocating(true);

    try {
      if (!("geolocation" in navigator)) {
        throw new Error("Geolocation is not supported in this browser.");
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60_000,
        })
      );

      setCoords({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });

      // In case coords is unchanged (rare), allow manual refetch.
      setTimeout(() => refetchNearby(), 0);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not access your location.";
      setLocationError(message);
    } finally {
      setIsLocating(false);
    }
    // setCoords, setIsLocating, setLocationError are stable React state setters.
    // refetchNearby is stable (empty-dep useCallback inside useDataFetcher).
  }, [refetchNearby]);

  // Background geolocation: if permission already granted, silently fetch nearby beaches.
  // handleUseLocation is memoized so it is safe to list as a dep here.
  useEffect(() => {
    let cancelled = false;
    try {
      navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
        if (!cancelled && result.state === 'granted') {
          handleUseLocation();
        }
      }).catch(() => {
        // Permissions API not supported - no-op
      });
    } catch {
      // Permissions API not supported - no-op
    }
    return () => { cancelled = true; };
  }, [handleUseLocation]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Your daily surf report starts here</h2>
        <p className="text-gray-600 text-sm">
          Pick your beach and we&apos;ll tell you when conditions are best to paddle out
        </p>
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleUseLocation}
          disabled={isLocating}
          className="w-full"
        >
          {isLocating ? "Finding nearby beaches..." : "Use my location"}
        </Button>

        {(nearbyLoading || nearbyError || locationError) && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            {locationError ? (
              <p className="text-red-600" role="alert">
                {locationError}
              </p>
            ) : nearbyError ? (
              <p className="text-red-600" role="alert">
                {nearbyError}
              </p>
            ) : (
              <p className="text-muted-foreground">Loading nearby beaches…</p>
            )}
          </div>
        )}

        {nearbyBeaches.length > 0 && (
          <div className="space-y-2">
            <Label>Nearby beaches</Label>
            <div className="grid grid-cols-1 gap-2">
              {nearbyBeaches.slice(0, 6).map((beach) => (
                <button
                  key={beach.id}
                  type="button"
                  onClick={() => selectBeach(beach)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border rounded-lg flex items-center gap-3"
                >
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{beach.name}</div>
                    {(beach.city || beach.state || beach.region) && (
                      <div className="text-sm text-gray-500 truncate">
                        {[beach.city, beach.state || beach.region]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Popular beaches - shown only when no nearby results and no search query */}
      {nearbyBeaches.length === 0 && query.trim().length === 0 && popularBeaches.length > 0 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground">Popular beaches</Label>
          <div className="grid grid-cols-2 gap-2">
            {popularBeaches.map((beach) => (
              <button
                key={beach.id}
                type="button"
                onClick={() => selectBeach(beach)}
                className="px-3 py-2.5 text-left hover:bg-gray-50 border rounded-lg text-sm transition-colors"
              >
                <div className="font-medium truncate">{beach.name}</div>
                {(beach.city || beach.state) && (
                  <div className="text-xs text-muted-foreground truncate">
                    {[beach.city, beach.state].filter(Boolean).join(', ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="beachSearch">Search for your beach</Label>
        <div className="relative">
          <Input
            id="beachSearch"
            placeholder="e.g., Malibu, Pipeline, Rincon..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-ocean-blue border-t-transparent rounded-full" />
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((beach) => (
                <button
                  key={beach.id}
                  type="button"
                  onClick={() => selectBeach(beach)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                >
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{beach.name}</div>
                    {(beach.region || beach.country) && (
                      <div className="text-sm text-gray-500">
                        {[beach.region, beach.country].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {searchError && (
          <p className="text-sm text-red-600 mt-2" role="alert">
            {searchError}
          </p>
        )}
        {selectedBeach && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-ocean-blue" />
            <span className="font-medium">{selectedBeach.name}</span>
          </div>
        )}
        {errors.homeBeachId && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {errors.homeBeachId.message}
          </p>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900">
          <strong>Tip:</strong> You can change your home beach anytime from your
          profile settings
        </p>
      </div>

      <div className="space-y-3">
        <Button type="submit" className="w-full" disabled={!isValid}>
          Continue
        </Button>
        <button
          type="button"
          onClick={handleSkipForNow}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
