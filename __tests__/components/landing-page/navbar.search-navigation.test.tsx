/**
 * Pins the navbar's search wiring: clicking a beach suggestion in the
 * landing-navbar search must route to the hierarchical beach detail page,
 * NOT /map?search=<name>.
 *
 * Today the navbar passes onSelect={(beach) => navigateToMap(beach.name)} which
 * hijacks the autocomplete's default detail-page navigation. Removing that
 * onSelect override is the fix.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/landing-page/navbar";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

jest.mock("@/hooks/use-landing-location", () => ({
  useLandingLocation: () => ({ regionName: null, isLoading: false }),
}));

jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthModalOpened: jest.fn(),
}));

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSigninCtaClick: jest.fn(),
  trackSignupCtaClick: jest.fn(),
  trackSignupCtaView: jest.fn(),
}));

beforeEach(() => {
  pushMock.mockClear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: [
        {
          id: "1",
          name: "Ocean Beach",
          slug: "ocean-beach",
          city: "San Diego",
          state: "California",
          country: "USA",
          break_type: "jetty",
          average_rating: 3.76,
        },
      ],
    }),
  }) as unknown as typeof global.fetch;
});

test("clicking a beach suggestion in the navbar search routes to the beach detail page (not /map)", async () => {
  const user = userEvent.setup();
  render(<Navbar />);

  // The navbar lazy-mounts the search; under NODE_ENV=test, hero-search-lazy
  // skips requestIdleCallback and renders the autocomplete eagerly. Wait for
  // the cmdk combobox specifically (the placeholder is a plain <input>, the
  // autocomplete renders role="combobox").
  const input = await screen.findByRole("combobox");
  await user.type(input, "ocean");

  await waitFor(() => screen.getByText("Ocean Beach"));
  await user.click(screen.getByText("Ocean Beach"));

  expect(pushMock).toHaveBeenCalledTimes(1);
  const url = pushMock.mock.calls[0][0];
  expect(url).toBe("/ca/san-diego/ocean-beach");
  expect(url).not.toMatch(/^\/map/);
});
