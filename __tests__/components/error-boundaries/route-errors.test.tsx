import { render, screen } from "@testing-library/react";
import RootError from "@/app/error";
import AuthError from "@/app/auth/error";
import DiscoverError from "@/app/discover/error";
import SessionsError from "@/app/sessions/error";
import MapError from "@/app/map/error";
import ProfileError from "@/app/profile/error";
import BeachError from "@/app/beach/[slug]/error";
import IntentBeachError from "@/app/[intent]/[city]/[beachSlug]/error";

jest.mock("@/components/error-boundaries/utils/error-logger", () => ({
  logErrorBoundary: jest.fn(),
}));

// Copy fixtures from origin/main before the route error factory refactor.
const routes = [
  { route: "root", Component: RootError, title: "Application Error", description: "An unexpected error occurred in the application. Please try refreshing the page." },
  { route: "auth", Component: AuthError, title: "Authentication Error", description: "We encountered a problem with authentication. Please try signing in again." },
  { route: "discover", Component: DiscoverError, title: "Discover Error", description: "We couldn't load the discover page. Please try again." },
  { route: "sessions", Component: SessionsError, title: "Sessions Error", description: "We couldn't load your surf sessions. Please try again." },
  { route: "map", Component: MapError, title: "Map Error", description: "We couldn't load the map. Please check your connection and try again." },
  { route: "profile", Component: ProfileError, title: "Profile Error", description: "We couldn't load your profile. Please try again." },
  { route: "beach/[slug]", Component: BeachError, title: "Beach Details Error", description: "We couldn't load the beach details. Please try again or return to the home page." },
  { route: "[intent]/[city]/[beachSlug]", Component: IntentBeachError, title: "Beach Details Error", description: "We couldn't load the beach details. Please try again or return to the home page." },
];

it.each(routes)("preserves the full origin/main error copy for $route", ({ Component, title, description }) => {
  render(<Component error={new Error("Test route error")} reset={jest.fn()} />);

  expect(screen.getByRole("heading", { name: title }).textContent).toBe(title);
  expect(screen.getByText(description, { exact: true }).textContent).toBe(description);
});
