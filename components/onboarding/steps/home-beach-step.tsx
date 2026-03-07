"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  homeBeachSchema,
  HomeBeachFormData,
} from "@/lib/schemas/onboarding-schemas";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useAuth } from "@/context/auth-context";
import { skipOnboarding } from "@/actions/onboarding-actions";
import { handleOnboardingDismiss } from "../onboarding-utils";
import { Label } from "@/components/ui/label";
import { CheckCircle, MapPin } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";

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
  const reducedMotion = useReducedMotion();
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [celebratingBeachId, setCelebratingBeachId] = useState<string | null>(null);
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
    setCelebratingBeachId(beach.id);
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

    // UX: celebrate selection with a brief pause before advancing
    if (reducedMotion) {
      nextStep();
    } else {
      setTimeout(() => nextStep(), 500);
    }
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
        <h2 className="text-white font-roboto text-2xl font-bold mb-2">
          Where do you surf?
        </h2>
        <p className="text-white/60 text-sm">
          Pick your home break — we&apos;ll dial your forecast to it
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={isLocating}
          className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <MapPin className="h-4 w-4" />
          {isLocating ? "Finding nearby beaches..." : "Use my location"}
        </button>

        {(nearbyLoading || nearbyError || locationError) && (
          <div className="rounded-lg border border-white/20 bg-white/5 p-3 text-sm">
            {locationError ? (
              <p className="text-red-400" role="alert">
                {locationError}
              </p>
            ) : nearbyError ? (
              <p className="text-red-400" role="alert">
                {nearbyError}
              </p>
            ) : (
              <p className="text-white/60">Loading nearby beaches…</p>
            )}
          </div>
        )}

        {nearbyBeaches.length > 0 && (
          <div className="space-y-2">
            <Label className="text-white/60 text-xs uppercase tracking-wide">Nearby beaches</Label>
            <div className="grid grid-cols-1 gap-2">
              {nearbyBeaches.slice(0, 6).map((beach) => {
                const isCelebrating = celebratingBeachId === beach.id;
                return (
                  <button
                    key={beach.id}
                    type="button"
                    onClick={() => selectBeach(beach)}
                    className={`w-full px-4 py-3 text-left rounded-lg flex items-center gap-3 transition-colors ${
                      isCelebrating
                        ? "border border-[#F78E42] bg-[#F78E42]/10"
                        : "bg-white/10 border border-white/20 hover:bg-white/15"
                    }`}
                  >
                    <MapPin className="h-4 w-4 text-white/50 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white truncate">{beach.name}</div>
                      {(beach.city || beach.state || beach.region) && (
                        <div className="text-sm text-white/60 truncate">
                          {[beach.city, beach.state || beach.region]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                    {isCelebrating && (
                      <motion.div
                        initial={reducedMotion ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", ...HOME_HEADER_MOTION.spring }}
                      >
                        <CheckCircle className="h-5 w-5 text-[#F78E42] flex-shrink-0" />
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Popular beaches - shown only when no nearby results and no search query */}
      {nearbyBeaches.length === 0 && query.trim().length === 0 && popularBeaches.length > 0 && (
        <div className="space-y-2">
          <Label className="text-white/60 text-xs uppercase tracking-wide">Popular beaches</Label>
          <div className="grid grid-cols-2 gap-2">
            {popularBeaches.map((beach) => {
              const isCelebrating = celebratingBeachId === beach.id;
              return (
                <button
                  key={beach.id}
                  type="button"
                  onClick={() => selectBeach(beach)}
                  className={`px-3 py-2.5 text-left rounded-lg text-sm transition-colors ${
                    isCelebrating
                      ? "border border-[#F78E42] bg-[#F78E42]/10"
                      : "bg-white/10 border border-white/20 hover:bg-white/15"
                  }`}
                >
                  <div className="font-medium text-white truncate">{beach.name}</div>
                  {(beach.city || beach.state) && (
                    <div className="text-xs text-white/60 truncate">
                      {[beach.city, beach.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="beachSearch" className="text-white/60 text-xs uppercase tracking-wide">
          Search for your beach
        </Label>
        <div className="relative mt-1">
          <input
            id="beachSearch"
            placeholder="e.g., Malibu, Pipeline, Rincon..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#F78E42]/50 focus:border-[#F78E42]/50"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white/80 rounded-full" />
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-[#1A2744] border border-white/20 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {searchResults.map((beach) => (
                <button
                  key={beach.id}
                  type="button"
                  onClick={() => selectBeach(beach)}
                  className="w-full px-4 py-3 text-left hover:bg-white/10 flex items-center gap-3 border-b border-white/10 last:border-b-0 transition-colors"
                >
                  <MapPin className="h-4 w-4 text-white/50 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-white">{beach.name}</div>
                    {(beach.region || beach.country) && (
                      <div className="text-sm text-white/60">
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
          <p className="text-sm text-red-400 mt-2" role="alert">
            {searchError}
          </p>
        )}
        {selectedBeach && (
          <div className="mt-3 p-3 bg-[#F78E42]/10 border border-[#F78E42]/30 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#F78E42]" />
            <span className="font-medium text-white">{selectedBeach.name}</span>
          </div>
        )}
        {errors.homeBeachId && (
          <p className="text-sm text-red-400 mt-1" role="alert">
            {errors.homeBeachId.message}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={!isValid}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-[#F78E42] to-[#D57835] text-white font-semibold text-sm disabled:opacity-40 transition-opacity"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={handleSkipForNow}
          className="w-full text-sm text-white/50 hover:text-white/70 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
