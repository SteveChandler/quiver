/**
 * Trichotomy of autocomplete dropdown states:
 *  - error  → "Couldn't search right now." + browse-by-state link
 *  - empty  → "No beaches found matching '<query>'" + browse-by-state link
 *  - results → list of beach suggestions
 *
 * Today, an API error renders the empty-state copy (misleading). We add a
 * dedicated error branch that reads the `error` field already exposed by
 * useBeachAutocomplete.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

test("renders an explicit error state when the search API errors", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof global.fetch;
  const user = userEvent.setup();
  render(<BeachSearchAutocomplete />);
  await user.type(
    screen.getByPlaceholderText(/search surf spots/i),
    "ocean beach"
  );
  await waitFor(() => screen.getByText(/couldn['']?t search right now/i));
  // NOT the empty-state copy
  expect(screen.queryByText(/no beaches found matching/i)).toBeNull();
  // Browse-by-state escape hatch present
  expect(
    screen.getByRole("link", { name: /browse all beaches by state/i })
  ).toHaveAttribute("href", "/beaches/usa");
});

test("renders the friendly empty state for a real zero-match query", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  }) as unknown as typeof global.fetch;
  const user = userEvent.setup();
  render(<BeachSearchAutocomplete />);
  await user.type(screen.getByPlaceholderText(/search surf spots/i), "zzqq99");
  await waitFor(() => screen.getByText(/no beaches found matching/i));
  expect(screen.queryByText(/couldn['']?t search right now/i)).toBeNull();
  expect(
    screen.getByRole("link", { name: /browse all beaches by state/i })
  ).toHaveAttribute("href", "/beaches/usa");
});

test("renders results normally when the API returns matches", async () => {
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
  const user = userEvent.setup();
  render(<BeachSearchAutocomplete />);
  await user.type(screen.getByPlaceholderText(/search surf spots/i), "ocean");
  await waitFor(() => screen.getByText("Ocean Beach"));
  expect(screen.queryByText(/couldn['']?t search right now/i)).toBeNull();
  expect(screen.queryByText(/no beaches found matching/i)).toBeNull();
});
