import { renderHook } from "@testing-library/react";
import { useProfileContext } from "@/context/profile-context";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useOracleData } from "@/hooks/use-oracle-data";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";

jest.mock("@/context/profile-context", () => ({
  useProfileContext: jest.fn(),
}));

jest.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: jest.fn(),
}));

jest.mock("@/hooks/use-surf-discovery", () => ({
  useSurfDiscovery: jest.fn(),
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));

// The only fetcher in the hook is the home beach's best photo.
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: () => ({ data: "https://photos.example/home-beach.jpg", loading: false }),
}));

const HOME_BEACH = { id: "home-1", name: "Home Break", lat: 32.75, lon: -117.25 };

function discoveryWithTop(beach: Record<string, unknown>) {
  return {
    discovery: {
      recommendations: [{ beach, score: 72 }],
      recommendationAvailability: { state: "available" },
    },
    loading: false,
    error: null,
  };
}

describe("useOracleData hero photo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useProfileContext as jest.Mock).mockReturnValue({
      profile: { id: "profile-1", experience_level: "intermediate" },
      homeBeach: HOME_BEACH,
      refreshProfile: jest.fn(),
      isLoading: false,
    });
    (useGeolocation as jest.Mock).mockReturnValue({
      coords: { lat: 32.75, lon: -117.25 },
      loading: false,
      source: "default",
      usingDefaultLocation: true,
      requestLocation: jest.fn(),
    });
  });

  it("uses the home beach's photo while the hero is the home beach", () => {
    (useSurfDiscovery as jest.Mock).mockReturnValue(discoveryWithTop({ ...HOME_BEACH }));

    const { result } = renderHook(() => useOracleData());

    expect(result.current.heroPhotoUrl).toBe("https://photos.example/home-beach.jpg");
  });

  it("never shows the home beach's photo under another beach's name", () => {
    (useSurfDiscovery as jest.Mock).mockReturnValue(
      discoveryWithTop({
        id: "other-1",
        name: "Sunset Cliffs",
        photo_url: "https://photos.example/sunset-cliffs.jpg",
      }),
    );

    const { result } = renderHook(() => useOracleData());

    expect(result.current.heroPhotoUrl).toBe("https://photos.example/sunset-cliffs.jpg");
  });

  it("reports no photo instead of stock imagery when the hero beach has none", () => {
    (useSurfDiscovery as jest.Mock).mockReturnValue(
      discoveryWithTop({ id: "other-2", name: "Unphotographed Reef", photo_url: null }),
    );

    const { result } = renderHook(() => useOracleData());

    expect(result.current.heroPhotoUrl).toBeNull();
  });
});
