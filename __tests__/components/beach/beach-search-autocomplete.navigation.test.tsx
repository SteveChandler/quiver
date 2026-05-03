/**
 * Regression locks for the beach search autocomplete's default navigation
 * behavior. Pins the contract that — absent an `onSelect` override — clicking
 * a suggestion routes to the hierarchical beach detail URL (NOT /map).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

const oceanBeach = {
  id: "1",
  name: "Ocean Beach",
  slug: "ocean-beach",
  city: "San Diego",
  state: "California",
  country: "USA",
  break_type: "jetty",
  average_rating: 3.76,
};

beforeEach(() => {
  pushMock.mockClear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [oceanBeach] }),
  }) as unknown as typeof global.fetch;
});

test("clicking a suggestion routes to the beach detail page (not /map) when no onSelect prop is provided", async () => {
  const user = userEvent.setup();
  render(<BeachSearchAutocomplete />);
  await user.type(screen.getByPlaceholderText(/search surf spots/i), "ocean");
  await waitFor(() => screen.getByText("Ocean Beach"));
  await user.click(screen.getByText("Ocean Beach"));
  expect(pushMock).toHaveBeenCalledTimes(1);
  const url = pushMock.mock.calls[0][0];
  expect(url).not.toMatch(/^\/map/);
  expect(url).toBe("/ca/san-diego/ocean-beach");
});

test("clicking a suggestion still routes to detail when navbar-style props are supplied (no onSelect override)", async () => {
  // Replicates how the navbar should call the autocomplete post-fix:
  // onFallback supplied (for empty-Enter map fallback), but NO onSelect override.
  const onFallback = jest.fn();
  const user = userEvent.setup();
  render(<BeachSearchAutocomplete onFallback={onFallback} source="landing-navbar" />);
  await user.type(screen.getByPlaceholderText(/search surf spots/i), "ocean");
  await waitFor(() => screen.getByText("Ocean Beach"));
  await user.click(screen.getByText("Ocean Beach"));
  expect(pushMock).toHaveBeenCalledWith("/ca/san-diego/ocean-beach");
  expect(onFallback).not.toHaveBeenCalled();
});
