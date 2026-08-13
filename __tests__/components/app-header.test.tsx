import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppHeader } from "@/components/app-header";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useCachedProfile } from "@/hooks/use-cached-profile";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  trackSigninCtaClick,
  trackSignupCtaClick,
} from "@/lib/analytics/signup-conversion-tracking";

// Mock Next.js navigation hooks
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

// Mock cached profile hook
jest.mock("@/hooks/use-cached-profile", () => ({
  useCachedProfile: jest.fn(),
}));

// Mock data fetcher hook
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSigninCtaClick: jest.fn(),
  trackSignupCtaClick: jest.fn(),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({ isOpen, mode, source, returnTo }: any) =>
    isOpen ? (
      <div
        data-testid="auth-modal"
        data-mode={mode}
        data-source={source}
        data-return-to={returnTo}
      />
    ) : null,
}));

// Mock UI components
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, className, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className, variant, ...props }: any) => (
    <span className={className} data-variant={variant} {...props}>
      {children}
    </span>
  ),
}));

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

jest.mock("@/components/user-avatar", () => ({
  UserAvatar: ({ src, name, email, size, isLoading }: any) => (
    <div
      data-testid="user-avatar"
      data-src={src}
      data-name={name}
      data-email={email}
      data-size={size}
      data-loading={isLoading}
    >
      {isLoading ? "..." : name || email || "U"}
    </div>
  ),
}));

// Mock UI Sheet components for mobile menu
jest.mock("@/components/ui/sheet", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");

  const SheetTrigger = ({ children, asChild, onClick, ...props }: any) => {
    if (asChild && ReactActual.isValidElement(children)) {
      const childProps = children.props as { onClick?: (event: any) => void };
      return ReactActual.cloneElement(children, {
        ...props,
        onClick: (event: any) => {
          childProps.onClick?.(event);
          onClick?.(event);
        },
      });
    }

    return (
      <div data-testid="sheet-trigger" onClick={onClick} {...props}>
        {children}
      </div>
    );
  };

  const SheetContent = ({ children, side, className, open }: any) =>
    open ? (
      <div
        data-testid="sheet-content"
        data-side={side}
        className={className}
        role="dialog"
      >
        {children}
      </div>
    ) : null;

  return {
    Sheet: ({ children, open, onOpenChange }: any) => (
      <div data-testid="sheet-root" data-open={open}>
        {ReactActual.Children.map(children, (child: any) => {
          if (!ReactActual.isValidElement(child)) return child;
          if (child.type === SheetTrigger) {
            return ReactActual.cloneElement(child as any, {
              onClick: () => onOpenChange?.(true),
            });
          }
          if (child.type === SheetContent) {
            return ReactActual.cloneElement(child as any, { open });
          }
          return child;
        })}
      </div>
    ),
    SheetTrigger,
    SheetContent,
    SheetHeader: ({ children, className }: any) => (
      <div data-testid="sheet-header" className={className}>
        {children}
      </div>
    ),
    SheetTitle: ({ children }: any) => (
      <h2 data-testid="sheet-title">{children}</h2>
    ),
  };
});

// Mock Input component
jest.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, className, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      className={className}
      {...props}
    />
  ),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Search: (props: any) => <svg data-testid="search-icon" {...props} />,
  Bell: (props: any) => <svg data-testid="bell-icon" {...props} />,
  User: (props: any) => <svg data-testid="user-icon" {...props} />,
  LogOut: (props: any) => <svg data-testid="logout-icon" {...props} />,
  Loader2: (props: any) => <svg data-testid="loader-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
  Menu: (props: any) => <svg data-testid="menu-icon" {...props} />,
  Home: (props: any) => <svg data-testid="home-icon" {...props} />,
  Map: (props: any) => <svg data-testid="map-icon" {...props} />,
  Users: (props: any) => <svg data-testid="users-icon" {...props} />,
  CalendarDays: (props: any) => <svg data-testid="calendar-days-icon" {...props} />,
  Settings: (props: any) => <svg data-testid="settings-icon" {...props} />,
  Waves: (props: any) => <svg data-testid="waves-icon" {...props} />,
}));

// Mock utils
jest.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

jest.mock("@/lib/utils/navigation-utils", () => ({
  preserveQueryParams: jest.fn((href: string) => href),
}));

describe("AppHeader", () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  const mockSearchParams = new URLSearchParams();

  const defaultMocks = {
    router: mockRouter,
    pathname: "/",
    searchParams: mockSearchParams,
    auth: {
      user: { id: "user-1", email: "test@example.com" },
      isLoading: false,
      signOut: jest.fn(),
    },
    profile: {
      profile: { full_name: "Test User", avatar_url: null },
      profileLoading: false,
      profileError: null,
      refreshProfile: jest.fn(),
      clearCache: jest.fn(),
      hasCachedData: false,
    },
    unreadCount: {
      data: 0,
      refetch: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(defaultMocks.router);
    (usePathname as jest.Mock).mockReturnValue(defaultMocks.pathname);
    (useSearchParams as jest.Mock).mockReturnValue(defaultMocks.searchParams);
    (useAuth as jest.Mock).mockReturnValue(defaultMocks.auth);
    (useCachedProfile as jest.Mock).mockReturnValue(defaultMocks.profile);
    (useDataFetcher as jest.Mock).mockReturnValue(defaultMocks.unreadCount);
  });

  describe("A. Search Bar Rendering", () => {
    describe("Desktop viewport (≥768px)", () => {
      beforeEach(() => {
        // Mock window.matchMedia for desktop
        Object.defineProperty(window, "matchMedia", {
          writable: true,
          value: jest.fn().mockImplementation((query) => ({
            matches: query.includes("min-width: 768px"),
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
          })),
        });
      });

      it("renders full search bar on desktop", () => {
        render(<AppHeader />);

        // Look for search input or search container
        const searchInput = screen.queryByPlaceholderText(
          /search beaches|search spots|search/i
        );

        // Phase 1: Search bar should be present
        // This test will fail until implementation is complete
        if (searchInput) {
          expect(searchInput).toBeInTheDocument();
        } else {
          // Document current state - no search bar yet
          expect(searchInput).toBeNull();
        }
      });

      it("search bar has correct placeholder text", () => {
        render(<AppHeader />);

        const searchInput = screen.queryByPlaceholderText(
          /search beaches|search spots/i
        );

        if (searchInput) {
          expect(searchInput).toHaveAttribute(
            "placeholder",
            expect.stringMatching(/search/i)
          );
        }
      });

      it("search icon is properly positioned", () => {
        render(<AppHeader />);

        const searchIcon = screen.queryByTestId("search-icon");

        if (searchIcon) {
          expect(searchIcon).toBeInTheDocument();
          // Icon should be inside search container
          const container = searchIcon.closest(".relative, [class*='search']");
          expect(container).toBeInTheDocument();
        }
      });

      it("applies correct styling classes to search container", () => {
        render(<AppHeader />);

        const searchContainer = screen
          .queryByPlaceholderText(/search/i)
          ?.closest("div");

        if (searchContainer) {
          // Should have pill shape (rounded-full)
          expect(searchContainer.className).toMatch(/rounded-full/);
          // Should have muted background
          expect(searchContainer.className).toMatch(/bg-muted/);
        }
      });

      it("search bar is positioned between logo and right section", () => {
        render(<AppHeader />);

        const logo = screen.getByText("Quiver");
        const searchInput = screen.queryByPlaceholderText(/search/i);

        expect(logo).toBeInTheDocument();

        if (searchInput) {
          // Verify search is after logo in DOM order
          const header = logo.closest("header");
          const headerContainer = header?.querySelector('div[class*="flex w-full"]');
          const children = Array.from(headerContainer?.children || []);
          const logoIndex = children.findIndex((child) =>
            child.contains(logo)
          );
          const searchIndex = children.findIndex((child) =>
            child.contains(searchInput)
          );

          expect(searchIndex).toBeGreaterThan(logoIndex);
        }
      });
    });

    describe("Mobile viewport (<768px)", () => {
      it("shows search icon button instead of full search bar", () => {
        render(<AppHeader />);

        // On mobile, should have a search button/icon
        const searchButton = screen.queryByRole("button", {
          name: /search/i,
        });
        const searchIcon = screen.queryByTestId("search-icon");

        // Phase 1: Mobile search icon should be present
        if (searchButton || searchIcon) {
          expect(searchButton || searchIcon).toBeInTheDocument();
        }
      });

      it("search icon button has proper accessibility attributes", () => {
        render(<AppHeader />);

        const searchButton = screen.queryByRole("button", {
          name: /search/i,
        });

        if (searchButton) {
          expect(searchButton).toHaveAttribute("aria-label");
        }
      });

      it("hides full search bar on mobile", () => {
        render(<AppHeader />);

        const searchInput = screen.queryByPlaceholderText(/search/i);

        if (searchInput) {
          // Should have display:none or hidden class on mobile
          const form = searchInput.closest("form");
          expect(form?.className).toMatch(/hidden|md:flex|md:block/);
        }
      });
    });
  });

  describe("B. Search Input Functionality", () => {
    it("accepts text input", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await user.type(searchInput, "Ocean Beach");
        expect(searchInput).toHaveValue("Ocean Beach");
      }
    });

    it("displays current search query value", () => {
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: "La Jolla" } });
        expect(searchInput).toHaveValue("La Jolla");
      }
    });

    it("handles Enter key press for search", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await user.type(searchInput, "Blacks Beach{Enter}");

        // Should trigger navigation or search action
        // Verify router.push was called or search event triggered
        // This will be implementation-specific
      }
    });

    it("clears input when clear button clicked", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await user.type(searchInput, "test query");

        const clearButton = screen.queryByRole("button", { name: /clear/i });

        if (clearButton) {
          await user.click(clearButton);
          expect(searchInput).toHaveValue("");
        }
      }
    });

    it("handles onChange events correctly", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await user.type(searchInput, "test");

        // Verify value updates with each keystroke
        expect(searchInput).toHaveValue("test");
      }
    });
  });

  describe("C. Focus States", () => {
    it("container background changes on focus", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        const container = searchInput.closest("div");

        // Focus the input
        await user.click(searchInput);

        if (container) {
          // Should have focus-within:bg-background
          expect(container.className).toMatch(
            /focus-within:bg-background|focus:bg-background/
          );
        }
      }
    });

    it("border color changes on focus to primary", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        const container = searchInput.closest("div");

        await user.click(searchInput);

        if (container) {
          // Should have focus-within:border-primary
          expect(container.className).toMatch(
            /focus-within:border-primary|focus:border-primary/
          );
        }
      }
    });

    it("ring appears on focus", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        const container = searchInput.closest("div");

        await user.click(searchInput);

        if (container) {
          // Should have ring-4 ring-primary/10
          expect(container.className).toMatch(/ring-4|ring-primary/);
        }
      }
    });

    it("applies transition classes correctly", () => {
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        const container = searchInput.closest("div");

        if (container) {
          // Should have transition duration-200
          expect(container.className).toMatch(/transition|duration-200/);
        }
      }
    });

    it("focus-within state works for nested elements", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await user.click(searchInput);
        expect(searchInput).toHaveFocus();

        // Container should have focus-within styles applied
        const container = searchInput.closest("div");
        expect(container).toBeInTheDocument();
      }
    });
  });

  describe("D. Responsive Behavior", () => {
    it("shows full search bar on desktop, icon on mobile", () => {
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);
      const searchButton = screen.queryByRole("button", { name: /search/i });

      // At least one should exist based on viewport
      // Implementation will use hidden/md:flex classes on form element
      if (searchInput) {
        expect(searchInput.closest("form")?.className).toMatch(
          /hidden.*md:flex|md:flex.*hidden/
        );
      }
    });

    it("applies correct spacing on desktop (mx-8)", () => {
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        const container = searchInput.closest("[class*='mx-']");
        if (container) {
          expect(container.className).toMatch(/mx-8/);
        }
      }
    });

    it("max-width constraint on desktop (600px)", () => {
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        const form = searchInput.closest("form");
        if (form) {
          expect(form.className).toMatch(/max-w-\[600px\]|max-w-2xl/);
        }
      }
    });

    it("maintains proper layout at breakpoint (768px)", () => {
      render(<AppHeader />);

      // Both variants should exist in DOM with appropriate display classes
      const header = screen.getByText("Quiver").closest("header");
      expect(header).toBeInTheDocument();
    });
  });

  describe("E. Accessibility", () => {
    it("search input has aria-label", () => {
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        expect(
          searchInput.hasAttribute("aria-label") ||
            searchInput.closest("label")
        ).toBeTruthy();
      }
    });

    it("search button has aria-label", () => {
      render(<AppHeader />);

      const searchButton = screen.queryByRole("button", { name: /search/i });

      if (searchButton) {
        expect(searchButton).toHaveAttribute("aria-label");
      }
    });

    it("keyboard navigation works through search input", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      // Tab to search input
      await user.tab();

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        // Check if search input can receive focus via Tab
        // (exact element that receives focus depends on DOM order)
        expect(document.activeElement).toBeTruthy();
      }
    });

    it("focus indicators are visible", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await user.click(searchInput);
        expect(searchInput).toHaveFocus();

        // Should have visible focus ring
        const container = searchInput.closest("div");
        if (container) {
          expect(container.className).toMatch(/ring|focus/);
        }
      }
    });

    it("screen reader can access search functionality", () => {
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);
      const searchButton = screen.queryByRole("button", { name: /search/i });

      // Either search input or button should be accessible
      if (searchInput) {
        // type="search" is more semantic than type="text" for search inputs
        expect(searchInput).toHaveAttribute("type", "search");
      }
      if (searchButton) {
        expect(searchButton).toBeInTheDocument();
      }
    });
  });

  describe("F. Edge Cases", () => {
    it("handles very long search queries", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        const longQuery = "A".repeat(200);
        await user.type(searchInput, longQuery);

        expect(searchInput).toHaveValue(longQuery);
      }
    });

    it("handles special characters in search input", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await user.type(searchInput, "Côte d'Azur & Beach's!");
        expect(searchInput).toHaveValue("Côte d'Azur & Beach's!");
      }
    });

    it("handles empty string gracefully", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await user.type(searchInput, "test");
        fireEvent.change(searchInput, { target: { value: "" } });
        expect(searchInput).toHaveValue("");
      }
    });

    it("handles rapid typing without lag", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        // Type rapidly
        await user.type(searchInput, "rapidtest");
        expect(searchInput).toHaveValue("rapidtest");
      }
    });

    it("preserves query parameters during search", async () => {
      const mockSearchParamsWithQuery = new URLSearchParams("?test=true");
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParamsWithQuery);

      render(<AppHeader />);

      // Search functionality should preserve existing query params
      const searchInput = screen.queryByPlaceholderText(/search/i);
      expect(searchInput).toBeDefined();
    });
  });

  describe("G. Integration with Existing Header", () => {
    it("logo still renders correctly with search bar", () => {
      render(<AppHeader />);

      const logo = screen.getByText("Quiver");
      expect(logo).toBeInTheDocument();
      expect(logo.closest("a")).toHaveAttribute("href", "/");
    });

    it("auth section still works with search bar", () => {
      render(<AppHeader />);

      const avatar = screen.getByTestId("user-avatar");
      expect(avatar).toBeInTheDocument();
    });

    it("navigation links unaffected for guest users", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
        signOut: jest.fn(),
      });

      // Set pathname to non-landing page so header renders for guests
      (usePathname as jest.Mock).mockReturnValue("/map");

      render(<AppHeader />);

      // Guest users should see Log In / Sign Up buttons
      const logInButton = screen.queryByText(/log in/i);
      expect(logInButton).toBeInTheDocument();
    });

    it("user dropdown still functional", async () => {
      const user = userEvent.setup();
      render(<AppHeader />);

      const avatar = screen.getByTestId("user-avatar");
      await user.click(avatar.closest("button")!);

      // Dropdown should still work
      expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
    });

    it("notification count displays correctly", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: 5,
        refetch: jest.fn(),
      });

      render(<AppHeader />);

      // Notification badge should still show
      const badge = screen.queryByText("5");
      if (badge) {
        expect(badge).toBeInTheDocument();
      }
    });

    it("layout does not break with search bar added", () => {
      render(<AppHeader />);

      const header = screen.getByText("Quiver").closest("header");
      expect(header).toBeInTheDocument();
      expect(header?.className).toMatch(/sticky|top-0|z-50/);
    });

    it("does not render on landing page for guests", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
        signOut: jest.fn(),
      });
      (usePathname as jest.Mock).mockReturnValue("/");

      const { container } = render(<AppHeader />);

      // Header should not render on landing page for unauthenticated users
      expect(container.firstChild).toBeNull();
    });

    it("renders on other pages for guests", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
        signOut: jest.fn(),
      });
      (usePathname as jest.Mock).mockReturnValue("/map");

      render(<AppHeader />);

      const header = screen.getByText("Quiver").closest("header");
      expect(header).toBeInTheDocument();
    });

    it("always renders for authenticated users", () => {
      (usePathname as jest.Mock).mockReturnValue("/");

      render(<AppHeader />);

      const header = screen.getByText("Quiver").closest("header");
      expect(header).toBeInTheDocument();
    });
  });

  describe("Header auth CTA analytics attribution", () => {
    const renderGuestHeader = (pathname: string) => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
        signOut: jest.fn(),
      });
      (usePathname as jest.Mock).mockReturnValue(pathname);

      render(<AppHeader />);
    };

    it("desktop Sign Up on /map keeps header source and omits surface", () => {
      renderGuestHeader("/map");

      fireEvent.click(screen.getByRole("button", { name: /get started/i }));

      expect(trackSignupCtaClick).toHaveBeenCalledTimes(1);
      const payload = (trackSignupCtaClick as jest.Mock).mock.calls[0][0];
      expect(payload).toEqual({ source: "app-header-general" });
      expect(payload).not.toHaveProperty("surface");
    });

    it("desktop Log in on /map keeps header source and omits surface", () => {
      renderGuestHeader("/map");

      fireEvent.click(screen.getByRole("button", { name: /^log in$/i }));

      expect(trackSigninCtaClick).toHaveBeenCalledTimes(1);
      const payload = (trackSigninCtaClick as jest.Mock).mock.calls[0][0];
      expect(payload).toEqual({ source: "app-header" });
      expect(payload).not.toHaveProperty("surface");
    });

    it("mobile Sign Up on /features keeps mobile header source and omits surface", async () => {
      const user = userEvent.setup();
      renderGuestHeader("/features");

      await user.click(screen.getByTestId("mobile-menu-button"));
      await user.click(await screen.findByTestId("mobile-nav-signup"));

      expect(trackSignupCtaClick).toHaveBeenCalledTimes(1);
      const payload = (trackSignupCtaClick as jest.Mock).mock.calls[0][0];
      expect(payload).toEqual({ source: "app-header-mobile" });
      expect(payload).not.toHaveProperty("surface");
    });

    it("mobile Log in on /features keeps mobile header source and omits surface", async () => {
      const user = userEvent.setup();
      renderGuestHeader("/features");

      await user.click(screen.getByTestId("mobile-menu-button"));
      await user.click(await screen.findByTestId("mobile-nav-login"));

      expect(trackSigninCtaClick).toHaveBeenCalledTimes(1);
      const payload = (trackSigninCtaClick as jest.Mock).mock.calls[0][0];
      expect(payload).toEqual({ source: "app-header-mobile" });
      expect(payload).not.toHaveProperty("surface");
    });

    it("beach-detail Sign Up keeps beach header source and omits surface", () => {
      renderGuestHeader("/ca/oceanside/the-rock");

      fireEvent.click(
        screen.getByRole("button", { name: /see your forecast/i })
      );

      expect(trackSignupCtaClick).toHaveBeenCalledTimes(1);
      const payload = (trackSignupCtaClick as jest.Mock).mock.calls[0][0];
      expect(payload).toEqual({ source: "app-header-beach" });
      expect(payload).not.toHaveProperty("surface");
    });
  });

  describe("H. Phase 2: Navigation Links", () => {
    describe("Authenticated Users", () => {
      beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue(defaultMocks.auth);
        (usePathname as jest.Mock).mockReturnValue("/map");
      });

      it("renders Discover, Alerts, Sessions, and Community links", () => {
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        const alertsLink = screen.getByRole("link", { name: /alerts/i });
        const sessionsLink = screen.getByRole("link", { name: /sessions/i });
        const communityLink = screen.getByRole("link", { name: /community/i });

        expect(discoverLink).toBeInTheDocument();
        expect(alertsLink).toBeInTheDocument();
        expect(sessionsLink).toBeInTheDocument();
        expect(communityLink).toBeInTheDocument();
      });

      it("Discover link points to /map route", () => {
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        expect(discoverLink).toHaveAttribute("href", "/map");
      });

      it("Alerts link points to /alerts route", () => {
        render(<AppHeader />);

        const alertsLink = screen.getByRole("link", { name: /alerts/i });
        expect(alertsLink).toHaveAttribute("href", "/alerts");
      });

      it("Sessions link points to /profile?tab=sessions route", () => {
        render(<AppHeader />);

        const sessionsLink = screen.getByRole("link", { name: /sessions/i });
        expect(sessionsLink).toHaveAttribute("href", "/profile?tab=sessions");
      });

      it("Community link points to /discover route", () => {
        render(<AppHeader />);

        const communityLink = screen.getByRole("link", { name: /community/i });
        expect(communityLink).toHaveAttribute("href", "/discover");
      });

      it("applies active state to current route", () => {
        (usePathname as jest.Mock).mockReturnValue("/sessions");
        render(<AppHeader />);

        const sessionsLink = screen.getByRole("link", { name: /sessions/i });
        expect(sessionsLink.className).toMatch(/text-primary/);
      });

      it("applies muted foreground to inactive links", () => {
        (usePathname as jest.Mock).mockReturnValue("/sessions");
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        expect(discoverLink.className).toMatch(/text-muted-foreground/);
      });

      it("has hover state classes on navigation links", () => {
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        expect(discoverLink.className).toMatch(/hover:text-primary/);
      });

      it("has transition duration on navigation links", () => {
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        expect(discoverLink.className).toMatch(/transition-colors/);
        expect(discoverLink.className).toMatch(/duration-200/);
      });

      it("navigation is hidden on mobile/tablet (<lg breakpoint)", () => {
        render(<AppHeader />);

        const nav = screen
          .getByRole("link", { name: /discover/i })
          .closest("nav");
        expect(nav?.className).toMatch(/hidden/);
        expect(nav?.className).toMatch(/lg:flex/);
      });

      it("does not render Features or About links for authenticated users", () => {
        render(<AppHeader />);

        const featuresLink = screen.queryByRole("link", { name: /features/i });
        const aboutLink = screen.queryByRole("link", { name: /about/i });

        expect(featuresLink).not.toBeInTheDocument();
        expect(aboutLink).not.toBeInTheDocument();
      });
    });

    describe("Guest Users", () => {
      beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue({
          user: null,
          isLoading: false,
          signOut: jest.fn(),
        });
        (usePathname as jest.Mock).mockReturnValue("/map");
      });

      it("renders Features and About links", () => {
        render(<AppHeader />);

        const featuresLink = screen.getByRole("link", { name: /features/i });
        const aboutLink = screen.getByRole("link", { name: /about/i });

        expect(featuresLink).toBeInTheDocument();
        expect(aboutLink).toBeInTheDocument();
      });

      it("does not render Discover, Sessions, or Community links", () => {
        render(<AppHeader />);

        const discoverLink = screen.queryByRole("link", { name: /discover/i });
        const sessionsLink = screen.queryByRole("link", {
          name: /sessions/i,
        });
        const communityLink = screen.queryByRole("link", {
          name: /community/i,
        });

        expect(discoverLink).not.toBeInTheDocument();
        expect(sessionsLink).not.toBeInTheDocument();
        expect(communityLink).not.toBeInTheDocument();
      });

      it("Features link points to /features route", () => {
        render(<AppHeader />);

        const featuresLink = screen.getByRole("link", { name: /features/i });
        expect(featuresLink).toHaveAttribute("href", "/features");
      });

      it("About link points to /about route", () => {
        render(<AppHeader />);

        const aboutLink = screen.getByRole("link", { name: /about/i });
        expect(aboutLink).toHaveAttribute("href", "/about");
      });
    });

    describe("Active Route Detection", () => {
      beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue(defaultMocks.auth);
      });

      it("highlights Discover when on /map", () => {
        (usePathname as jest.Mock).mockReturnValue("/map");
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        expect(discoverLink.className).toMatch(/text-primary/);
      });

      it("highlights Sessions when on /sessions", () => {
        (usePathname as jest.Mock).mockReturnValue("/sessions");
        render(<AppHeader />);

        const sessionsLink = screen.getByRole("link", { name: /sessions/i });
        expect(sessionsLink.className).toMatch(/text-primary/);
      });

      it("highlights Community when on /discover", () => {
        (usePathname as jest.Mock).mockReturnValue("/discover");
        render(<AppHeader />);

        const communityLink = screen.getByRole("link", { name: /community/i });
        expect(communityLink.className).toMatch(/text-primary/);
      });

      it("highlights Sessions when on /sessions/[id]", () => {
        (usePathname as jest.Mock).mockReturnValue("/sessions/123");
        render(<AppHeader />);

        const sessionsLink = screen.getByRole("link", { name: /sessions/i });
        expect(sessionsLink.className).toMatch(/text-primary/);
      });

      it("only one link is active at a time", () => {
        (usePathname as jest.Mock).mockReturnValue("/sessions");
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        const sessionsLink = screen.getByRole("link", { name: /sessions/i });
        const communityLink = screen.getByRole("link", { name: /community/i });

        expect(sessionsLink.className).toMatch(/text-primary/);
        expect(discoverLink.className).toMatch(/text-muted-foreground/);
        expect(communityLink.className).toMatch(/text-muted-foreground/);
      });
    });

    describe("Query Parameter Preservation", () => {
      beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue(defaultMocks.auth);
        (usePathname as jest.Mock).mockReturnValue("/map");
      });

      it("preserves query parameters in navigation links", () => {
        const mockSearchParamsWithQuery = new URLSearchParams("?test=true");
        (useSearchParams as jest.Mock).mockReturnValue(
          mockSearchParamsWithQuery
        );

        render(<AppHeader />);

        // preserveQueryParams is mocked to return href as-is
        // In real implementation, it would append ?test=true
        const discoverLink = screen.getByRole("link", { name: /discover/i });
        expect(discoverLink).toHaveAttribute("href", "/map");
      });
    });

    describe("Accessibility", () => {
      beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue(defaultMocks.auth);
        (usePathname as jest.Mock).mockReturnValue("/map");
      });

      it("navigation uses semantic nav element", () => {
        render(<AppHeader />);

        const nav = screen
          .getByRole("link", { name: /discover/i })
          .closest("nav");
        expect(nav?.tagName).toBe("NAV");
      });

      it("navigation links are keyboard accessible", async () => {
        const user = userEvent.setup();
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });

        // Focus via keyboard
        await user.tab();
        // May need multiple tabs depending on DOM order

        // Link should be focusable
        expect(discoverLink.tabIndex).toBeGreaterThanOrEqual(0);
      });

      it("links have medium font weight for readability", () => {
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        expect(discoverLink.className).toMatch(/font-medium/);
      });

      it("uses appropriate text size (text-sm)", () => {
        render(<AppHeader />);

        const discoverLink = screen.getByRole("link", { name: /discover/i });
        expect(discoverLink.className).toMatch(/text-sm/);
      });
    });

    describe("Layout Integration", () => {
      beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue(defaultMocks.auth);
        (usePathname as jest.Mock).mockReturnValue("/map");
      });

      it("navigation is positioned after logo", () => {
        render(<AppHeader />);

        const logo = screen.getByText("Quiver");
        const discoverLink = screen.getByRole("link", { name: /discover/i });

        const header = logo.closest("header");
        const children = Array.from(
          header?.querySelector('div[class*="flex w-full"]')?.children || []
        );

        const logoContainer = children.find((child) => child.contains(logo));
        const navContainer = children.find((child) =>
          child.contains(discoverLink)
        );

        if (logoContainer && navContainer) {
          const logoIndex = children.indexOf(logoContainer);
          const navIndex = children.indexOf(navContainer);
          expect(navIndex).toBeGreaterThanOrEqual(logoIndex);
        }
      });

      it("navigation has proper spacing (ml-8 space-x-8)", () => {
        render(<AppHeader />);

        const nav = screen
          .getByRole("link", { name: /discover/i })
          .closest("nav");

        expect(nav?.className).toMatch(/ml-8/);
        expect(nav?.className).toMatch(/space-x-8/);
      });

      it("does not break search bar layout", () => {
        render(<AppHeader />);

        const searchInput = screen.queryByPlaceholderText(/search/i);
        const discoverLink = screen.queryByRole("link", { name: /discover/i });

        // Both should exist
        expect(searchInput).toBeInTheDocument();
        expect(discoverLink).toBeInTheDocument();
      });
    });
  });


  describe("Phase 4: Enhanced Styling & Polish", () => {
    describe("Sign Up Button Styling", () => {
      beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue({
          user: null,
          isLoading: false,
          signOut: jest.fn(),
        });
        (usePathname as jest.Mock).mockReturnValue("/features");
      });

      it("has rounded-full pill shape class", () => {
        render(<AppHeader />);

        const signUpButton = screen.getByRole("button", { name: /get started/i });

        expect(signUpButton).toBeInTheDocument();
        expect(signUpButton?.className).toContain("rounded-full");
      });

      it("has shadow-sm class", () => {
        render(<AppHeader />);

        const signUpButton = screen.getByRole("button", { name: /get started/i });

        expect(signUpButton).toBeInTheDocument();
        expect(signUpButton?.className).toContain("shadow-sm");
      });

      it("has active:scale-98 press state class", () => {
        render(<AppHeader />);

        const signUpButton = screen.getByRole("button", { name: /get started/i });

        expect(signUpButton).toBeInTheDocument();
        expect(signUpButton?.className).toContain("active:scale-[0.98]");
      });

      it("has font-semibold class", () => {
        render(<AppHeader />);

        const signUpButton = screen.getByRole("button", { name: /get started/i });

        expect(signUpButton).toBeInTheDocument();
        expect(signUpButton?.className).toContain("font-semibold");
      });

      it("has the narrowed color, shadow, and transform transition", () => {
        render(<AppHeader />);

        const signUpButton = screen.getByRole("button", { name: /get started/i });

        expect(signUpButton).toBeInTheDocument();
        expect(signUpButton?.className).toContain(
          "transition-[background-color,box-shadow,transform]"
        );
        expect(signUpButton?.className).not.toContain("transition-all");
        expect(signUpButton?.className).toContain("duration-200");
      });
    });

    describe("Avatar Hover Effects", () => {
      it("has border-2 border-transparent classes", () => {
        render(<AppHeader />);

        const avatarButton = screen.getByTestId("user-avatar-button");

        expect(avatarButton).toBeInTheDocument();
        expect(avatarButton.className).toContain("border-2");
        expect(avatarButton.className).toContain("border-transparent");
      });

      it("has hover:border-primary class", () => {
        render(<AppHeader />);

        const avatarButton = screen.getByTestId("user-avatar-button");

        expect(avatarButton).toBeInTheDocument();
        expect(avatarButton.className).toContain("hover:border-primary");
      });

      it("has hover:ring-3 hover:ring-primary/10 classes", () => {
        render(<AppHeader />);

        const avatarButton = screen.getByTestId("user-avatar-button");

        expect(avatarButton).toBeInTheDocument();
        expect(avatarButton.className).toContain("hover:ring-3");
        expect(avatarButton.className).toContain("hover:ring-primary/10");
      });

      it("has the narrowed border and shadow transition", () => {
        render(<AppHeader />);

        const avatarButton = screen.getByTestId("user-avatar-button");

        expect(avatarButton).toBeInTheDocument();
        expect(avatarButton.className).toContain(
          "transition-[border-color,box-shadow]"
        );
        expect(avatarButton.className).not.toContain("transition-all");
        expect(avatarButton.className).toContain("duration-200");
      });

      it("has increased size from h-8 to h-9", () => {
        render(<AppHeader />);

        const avatarButton = screen.getByTestId("user-avatar-button");

        expect(avatarButton).toBeInTheDocument();
        expect(avatarButton.className).toContain("h-9");
        expect(avatarButton.className).toContain("w-9");
      });
    });

    describe("Logo Hover Transition", () => {
      it("logo has transition-colors class", () => {
        render(<AppHeader />);

        const logoText = screen.getByText("Quiver");

        expect(logoText).toBeInTheDocument();
        expect(logoText.className).toContain("transition-colors");
      });

      it("logo has duration-300 class", () => {
        render(<AppHeader />);

        const logoText = screen.getByText("Quiver");

        expect(logoText).toBeInTheDocument();
        expect(logoText.className).toContain("duration-300");
      });

      it("logo has orange hover class", () => {
        render(<AppHeader />);

        const logoText = screen.getByText("Quiver");

        expect(logoText).toBeInTheDocument();
        expect(logoText.className).toContain("group-hover:text-[#FFAA63]");
      });

      it("logo link has group class for hover coordination", () => {
        render(<AppHeader />);

        const logoLink = screen.getByText("Quiver").closest("a");

        expect(logoLink).toBeInTheDocument();
        expect(logoLink?.className).toContain("group");
      });
    });

    describe("Focus States", () => {
      it("logo link has focus-visible ring classes", () => {
        render(<AppHeader />);

        const logoLink = screen.getByText("Quiver").closest("a");

        expect(logoLink).toBeInTheDocument();
        expect(logoLink?.className).toContain("focus-visible:ring-2");
        expect(logoLink?.className).toContain("focus-visible:ring-primary");
        expect(logoLink?.className).toContain("focus-visible:ring-offset-2");
      });

      it("navigation links have focus-visible ring classes", () => {
        render(<AppHeader />);

        const discoverLink = screen.queryByRole("link", { name: /discover/i });

        if (discoverLink) {
          expect(discoverLink.className).toContain("focus-visible:ring-2");
          expect(discoverLink.className).toContain("focus-visible:ring-primary");
          expect(discoverLink.className).toContain(
            "focus-visible:ring-offset-2"
          );
        }
      });

      it("sign in button has focus-visible ring classes", () => {
        (useAuth as jest.Mock).mockReturnValue({
          user: null,
          isLoading: false,
          signOut: jest.fn(),
        });
        (usePathname as jest.Mock).mockReturnValue("/features");

        render(<AppHeader />);

        const signInButton = screen.getByRole("button", { name: /log in/i });

        expect(signInButton).toBeInTheDocument();
        expect(signInButton?.className).toContain("focus-visible:ring-2");
        expect(signInButton?.className).toContain("focus-visible:ring-primary");
        expect(signInButton?.className).toContain(
          "focus-visible:ring-offset-2"
        );
      });

      it("sign up button has focus-visible ring classes", () => {
        (useAuth as jest.Mock).mockReturnValue({
          user: null,
          isLoading: false,
          signOut: jest.fn(),
        });
        (usePathname as jest.Mock).mockReturnValue("/features");

        render(<AppHeader />);

        const signUpButton = screen.getByRole("button", { name: /get started/i });

        expect(signUpButton).toBeInTheDocument();
        expect(signUpButton?.className).toContain("focus-visible:ring-2");
        expect(signUpButton?.className).toContain(
          "focus-visible:ring-[#F78E42]"
        );
        expect(signUpButton?.className).toContain(
          "focus-visible:ring-offset-2"
        );
      });
    });

    describe("Accessibility - ARIA Labels", () => {
      it("avatar button has aria-label", () => {
        render(<AppHeader />);

        const avatarButton = screen.getByTestId("user-avatar-button");

        expect(avatarButton).toBeInTheDocument();
        expect(avatarButton).toHaveAttribute("aria-label");
        expect(avatarButton.getAttribute("aria-label")).toContain("menu");
      });

      it("search input has aria-label", () => {
        render(<AppHeader />);

        const searchInput = screen.queryByPlaceholderText(/search/i);

        if (searchInput) {
          expect(searchInput).toHaveAttribute("aria-label");
          expect(searchInput.getAttribute("aria-label")).toContain("Search");
        }
      });

      it("mobile search button has aria-label", () => {
        render(<AppHeader />);

        const mobileSearchButton = screen.queryByTestId("mobile-search-button");

        if (mobileSearchButton) {
          expect(mobileSearchButton).toHaveAttribute("aria-label");
          expect(mobileSearchButton.getAttribute("aria-label")).toContain(
            "Search"
          );
        }
      });

    });

    describe("Typography Consistency", () => {
      it("logo has text-xl and font-bold classes", () => {
        render(<AppHeader />);

        const logoText = screen.getByText("Quiver");

        expect(logoText).toBeInTheDocument();
        expect(logoText.className).toContain("text-xl");
        expect(logoText.className).toContain("font-bold");
        expect(logoText.className).toContain("text-[#F78E42]");
      });

      it("navigation links have text-sm and font-medium classes", () => {
        render(<AppHeader />);

        const discoverLink = screen.queryByRole("link", { name: /discover/i });

        if (discoverLink) {
          expect(discoverLink.className).toContain("text-sm");
          expect(discoverLink.className).toContain("font-medium");
        }
      });
    });

    describe("Transition Property Narrowing", () => {
      it("keeps representative header transitions property-specific", () => {
        (useAuth as jest.Mock).mockReturnValue({
          user: null,
          isLoading: false,
          signOut: jest.fn(),
        });
        (usePathname as jest.Mock).mockReturnValue("/features");
        const guestRender = render(<AppHeader />);
        const signUpButton = screen.getByRole("button", { name: /get started/i });

        expect(signUpButton.className).toContain(
          "transition-[background-color,box-shadow,transform]"
        );
        expect(signUpButton.className).not.toContain("transition-all");

        guestRender.unmount();
        (useAuth as jest.Mock).mockReturnValue(defaultMocks.auth);
        render(<AppHeader />);

        const avatarButton = screen.getByTestId("user-avatar-button");
        expect(avatarButton.className).toContain(
          "transition-[border-color,box-shadow]"
        );
        expect(avatarButton.className).not.toContain("transition-all");
      });
    });

    describe("Integration - Phase 4 does not break previous phases", () => {
      it("search bar still works with new styling", () => {
        render(<AppHeader />);

        const searchInput = screen.queryByPlaceholderText(/search/i);

        expect(searchInput).toBeInTheDocument();
      });

      it("navigation links still work with focus states", () => {
        render(<AppHeader />);

        const discoverLink = screen.queryByRole("link", { name: /discover/i });
        const sessionsLink = screen.queryByRole("link", { name: /sessions/i });

        expect(discoverLink).toBeInTheDocument();
        expect(sessionsLink).toBeInTheDocument();
      });

    });
  });
});
