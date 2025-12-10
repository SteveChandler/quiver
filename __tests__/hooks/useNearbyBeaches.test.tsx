const rpcMock = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  __esModule: true,
  createClient: () => ({ rpc: rpcMock }),
}));

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import {
  fetchNearestBeaches,
  useNearbyBeaches,
} from "@/hooks/useNearbyBeaches";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function HookHarness({ lat, lon, limit }: { lat?: number; lon?: number; limit?: number }) {
  const { data } = useNearbyBeaches(lat, lon, limit ?? 4);
  return <pre data-testid="result">{JSON.stringify(data)}</pre>;
}

describe("useNearbyBeaches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  it("calls the Supabase nearest_beaches RPC and normalizes the payload", async () => {
    const rpcResponse = {
      data: [
        {
          id: "beach-1",
          name: "Ocean Beach",
          lat: 32.75,
          lon: -117.25,
          meters: 500,
          rating: 4.5,
          review_count: 12,
          image_url: "https://example.com/ob.jpg",
        },
      ],
      error: null,
    };

    rpcMock.mockResolvedValueOnce(rpcResponse as any);

    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <HookHarness lat={32.75} lon={-117.25} limit={3} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("nearest_beaches", {
        user_lat: 32.75,
        user_lon: -117.25,
        limit_n: 3,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("result").textContent).toContain("Ocean Beach");
    });

    const parsed = JSON.parse(screen.getByTestId("result").textContent || "[]");
    expect(parsed).toEqual([
      {
        id: "beach-1",
        name: "Ocean Beach",
        lat: 32.75,
        lon: -117.25,
        meters: 500,
        rating: 4.5,
        reviewCount: 12,
        imageUrl: "https://example.com/ob.jpg",
        slug: null,
        city: null,
        state: null,
      },
    ]);
  });

  it("does not invoke Supabase when coordinates are missing", async () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <HookHarness />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(rpcMock).not.toHaveBeenCalled();
      expect(screen.getByTestId("result").textContent).toBe("");
    });
  });
});

describe("fetchNearestBeaches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps raw RPC rows into the NearbyBeach shape", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: "beach-2",
          name: "Mission Beach",
          lat: 32.77,
          lon: -117.25,
          meters: 1609.344,
          rating: null,
          reviewCount: 5,
          map_image_url: null,
        },
      ],
      error: null,
    });

    const result = await fetchNearestBeaches(10, 20, 2);

    expect(result).toEqual([
      {
        id: "beach-2",
        name: "Mission Beach",
        lat: 32.77,
        lon: -117.25,
        meters: 1609.344,
        rating: null,
        reviewCount: 5,
        imageUrl: "/images/beach-placeholder.jpg",
        slug: null,
        city: null,
        state: null,
      },
    ]);
  });

  it("throws when Supabase responds with an error", async () => {
    const error = new Error("failed");
    rpcMock.mockResolvedValueOnce({ data: null, error } as any);

    await expect(fetchNearestBeaches(1, 2, 3)).rejects.toBe(error);
  });
});
