"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  homeBeachSchema,
  HomeBeachFormData,
} from "@/lib/schemas/onboarding-schemas";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
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
  const { data, updateData, nextStep } = useOnboardingStore();
  const reducedMotion = useReducedMotion();
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [celebratingBeachId, setCelebratingBeachId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
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

  // Switch to nearby mode when results arrive
  useEffect(() => {
    if (nearbyBeaches.length > 0) {
      setShowSearch(false);
    }
  }, [nearbyBeaches.length]);

  // "Maybe later" removed — plan abstract-exploring-phoenix (Commit B).
  // HomeBeachStep is the required activation gate. Real-activation rate
  // (home_beach_id set) was 25% of new signups for the 7d ending
  // 2026-04-17, driven by users tapping Maybe later before picking a
  // beach. Keeping this step non-skippable forces the single action that
  // actually makes the product work. Subsequent steps (LevelAndTime,
  // Payoff) keep their skip affordances — home beach is the only
  // non-negotiable. The dialog as a whole remains manually opened
  // (vast-dancing-whale invariant preserved for existing users); new
  // signups hit it via the `?onboarding=required` redirect path wired
  // from /auth/callback.

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

  // Background geolocation removed — only fetch nearby when user taps "Find me"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="font-handwritten text-3xl sm:text-4xl text-white mb-1">
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
          className="w-full px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <MapPin className="h-4 w-4" />
          {isLocating ? "Finding nearby beaches..." : nearbyBeaches.length > 0 ? "Nearby spots" : "Find me"}
        </button>

        {(nearbyLoading || nearbyError || locationError || (coords && !nearbyLoading && nearbyBeaches.length === 0)) && (
          <div className="rounded-lg border border-white/[0.12] bg-white/[0.04] p-3 text-sm">
            {locationError ? (
              <p className="text-red-400" role="alert">
                {locationError}
              </p>
            ) : nearbyError ? (
              <p className="text-red-400" role="alert">
                {nearbyError}
              </p>
            ) : nearbyLoading ? (
              <p className="text-white/50">Loading nearby beaches...</p>
            ) : (
              <p className="text-white/50">No beaches found nearby — try searching by name</p>
            )}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!showSearch && nearbyBeaches.length > 0 ? (
          <motion.div
            key="nearby"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="space-y-2"
          >
            {nearbyBeaches.slice(0, 4).map((beach) => {
              const isCelebrating = celebratingBeachId === beach.id;
              return (
                <button
                  key={beach.id}
                  type="button"
                  onClick={() => selectBeach(beach)}
                  className={`w-full px-4 py-3 text-left rounded-lg flex items-center gap-3 transition-colors ${
                    isCelebrating
                      ? "border border-[#F78E42] bg-[#F78E42]/10"
                      : "bg-white/[0.06] border border-white/[0.12] hover:bg-white/10"
                  }`}
                >
                  <MapPin className="h-4 w-4 text-white/50 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white truncate">{beach.name}</div>
                    {(beach.city || beach.state || beach.region) && (
                      <div className="text-sm text-white/50 truncate">
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
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="w-full text-sm text-white/40 hover:text-white/60 transition-colors pt-1"
            >
              Not here? Search by name
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="search"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            <Label htmlFor="beachSearch" className="text-white/50 text-xs uppercase tracking-wide">
              Search for your beach
            </Label>
            <div className="relative mt-1">
              <input
                id="beachSearch"
                placeholder="e.g., Malibu, Pipeline, Rincon..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                className="w-full px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#F78E42]/40 focus:border-[#F78E42]/40"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white/70 rounded-full" />
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-[#1A3A5C] border border-white/[0.12] rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {searchResults.map((beach) => (
                    <button
                      key={beach.id}
                      type="button"
                      onClick={() => selectBeach(beach)}
                      className="w-full px-4 py-3 text-left hover:bg-white/[0.08] flex items-center gap-3 border-b border-white/[0.08] last:border-b-0 transition-colors"
                    >
                      <MapPin className="h-4 w-4 text-white/50 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-white">{beach.name}</div>
                        {(beach.region || beach.country) && (
                          <div className="text-sm text-white/50">
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
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={!isValid}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-[#F78E42] to-[#D57835] text-white font-semibold text-sm disabled:opacity-40 transition-opacity"
        >
          Continue
        </button>
        {/* No footer microcopy. The subtitle above already says
            "Pick your home break — we'll dial your forecast to it."
            and the disabled Continue button communicates the
            requirement. Repeating it here read as nagging. Plan: D3. */}
      </div>
    </form>
  );
}
