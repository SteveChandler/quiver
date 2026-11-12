jest.mock("@/lib/services/wave-stations", () => ({ getNearbyStations: jest.fn() }));

import { render, screen } from "@testing-library/react";

import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { NearbyBuoysSlot } from "@/components/tide-stations/nearby-buoys-slot";
import { getNearbyStations } from "@/lib/services/wave-stations";

function buoy(id: string, slug: string, name: string, distance_km: number) {
  return { id, slug, name, distance_km };
}

async function renderSlot() {
  const element = await NearbyBuoysSlot({ lat: 32.87, lon: -117.26 });
  if (element) render(element);
  return element;
}

describe("NearbyBuoysSlot on tide station pages", () => {
  it("links the nearest buoys with distances and no live reading", async () => {
    (getNearbyStations as jest.Mock).mockResolvedValue([
      buoy("ndbc:46225", "torrey-pines-outer-ca-46225", "Torrey Pines Outer", 12.4),
      buoy("ndbc:46254", "scripps-nearshore-ca-46254", "Scripps Nearshore", 3.1),
      buoy("ndbc:46086", "san-clemente-basin-ca-46086", "San Clemente Basin", 120),
    ]);

    await renderSlot();

    const link = screen.getByRole("link", { name: /Torrey Pines Outer/ });
    expect(link).toHaveAttribute("href", "/buoys/station/torrey-pines-outer-ca-46225");
    expect(link).toHaveTextContent("12 km");
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByText(/ft|seconds|\bs\b/)).toBeNull();
  });

  it("renders nothing when the wave catalogue is not migrated yet", async () => {
    const missing = Object.assign(new Error("getNearbyStations: Could not find the function public.get_nearby_wave_stations"), {
      code: "PGRST202",
    });
    (getNearbyStations as jest.Mock).mockRejectedValue(missing);

    await expect(renderSlot()).resolves.toBeNull();
  });

  it("logs and renders nothing on any other read failure", async () => {
    (getNearbyStations as jest.Mock).mockRejectedValue(new Error("getNearbyStations: canceling statement due to statement timeout"));

    await expect(renderSlot()).resolves.toBeNull();
    expectConsoleWarnings([/Nearby buoys for tide station failed/]);
  });
});
