import React from "react";
import { render } from "@testing-library/react";
import { NativeAuthGuard } from "@/components/native-auth-guard";
import { useAuth } from "@/context/auth-context";
import { isNativeApp } from "@/lib/mobile/platform";
import { safeGetItem } from "@/lib/utils/safe-storage";
import {
  isRedirectLoopDetected,
  incrementRedirectAttempt,
  clearRedirectAttempts,
} from "@/lib/auth/auth-utils";
import { usePathname, useRouter } from "next/navigation";

// Mock Next.js navigation hooks
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

// Mock platform utils
jest.mock("@/lib/mobile/platform", () => ({
  isNativeApp: jest.fn(),
}));

// Mock safe storage
jest.mock("@/lib/utils/safe-storage", () => ({
  safeGetItem: jest.fn(),
}));

// Mock auth utils
jest.mock("@/lib/auth/auth-utils", () => ({
  isRedirectLoopDetected: jest.fn(),
  incrementRedirectAttempt: jest.fn(),
  clearRedirectAttempts: jest.fn(),
}));

describe("NativeAuthGuard", () => {
  const mockRouterReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    jest.mocked(useRouter).mockReturnValue({
      replace: mockRouterReplace,
      push: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    });

    jest.mocked(usePathname).mockReturnValue("/");

    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      session: null,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });

    jest.mocked(isNativeApp).mockReturnValue(true);
    jest.mocked(safeGetItem).mockReturnValue("1");
    jest.mocked(isRedirectLoopDetected).mockReturnValue(false);
  });

  it("renders nothing", () => {
    const { container } = render(<NativeAuthGuard />);
    expect(container.innerHTML).toBe("");
  });

  it("redirects native returning user to sign-in on home page", () => {
    // All default mocks are set up for this scenario
    render(<NativeAuthGuard />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/auth/sign-in");
    expect(incrementRedirectAttempt).toHaveBeenCalled();
  });

  it("includes redirectTo param for non-root pages", () => {
    jest.mocked(usePathname).mockReturnValue("/forecast");

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/auth/sign-in?redirectTo=%2Fforecast"
    );
    expect(incrementRedirectAttempt).toHaveBeenCalled();
  });

  it("includes redirectTo param for nested routes", () => {
    jest.mocked(usePathname).mockReturnValue("/sessions/abc123");

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/auth/sign-in?redirectTo=%2Fsessions%2Fabc123"
    );
  });

  it("does not redirect on web", () => {
    jest.mocked(isNativeApp).mockReturnValue(false);

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(incrementRedirectAttempt).not.toHaveBeenCalled();
  });

  it("does not redirect new users without returning flag", () => {
    jest.mocked(safeGetItem).mockReturnValue(null);

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(incrementRedirectAttempt).not.toHaveBeenCalled();
  });

  it("does not redirect authenticated users", () => {
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user123", email: "test@example.com" } as any,
      session: null,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });

    render(<NativeAuthGuard />);

    expect(clearRedirectAttempts).toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(incrementRedirectAttempt).not.toHaveBeenCalled();
  });

  it("does not redirect while loading", () => {
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      session: null,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(incrementRedirectAttempt).not.toHaveBeenCalled();
  });

  it("does not redirect on auth pages", () => {
    jest.mocked(usePathname).mockReturnValue("/auth/sign-in");

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(incrementRedirectAttempt).not.toHaveBeenCalled();
  });

  it("does not redirect on other auth routes", () => {
    jest.mocked(usePathname).mockReturnValue("/auth/sign-up");

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("does not redirect when loop detected", () => {
    jest.mocked(isRedirectLoopDetected).mockReturnValue(true);

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(incrementRedirectAttempt).not.toHaveBeenCalled();
  });

  it("handles returning flag set to empty string as truthy", () => {
    jest.mocked(safeGetItem).mockReturnValue("");

    render(<NativeAuthGuard />);

    // Empty string is falsy, should NOT redirect
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("handles returning flag set to any truthy value", () => {
    jest.mocked(safeGetItem).mockReturnValue("true");

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/auth/sign-in");
  });

  it("calls safeGetItem with correct key", () => {
    render(<NativeAuthGuard />);

    expect(safeGetItem).toHaveBeenCalledWith("quiver_returning_user");
  });

  it("does not call clearRedirectAttempts for unauthenticated users", () => {
    render(<NativeAuthGuard />);

    expect(clearRedirectAttempts).not.toHaveBeenCalled();
  });

  it("prevents double-redirect on rerender with same deps", () => {
    const { rerender } = render(<NativeAuthGuard />);

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(incrementRedirectAttempt).toHaveBeenCalledTimes(1);

    // Rerender with same deps — effect does not re-run, count stays at 1
    rerender(<NativeAuthGuard />);

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
  });

  it("does not redirect when all conditions fail", () => {
    jest.mocked(isNativeApp).mockReturnValue(false);
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user123" } as any,
      session: null,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("prioritizes auth check over returning user check", () => {
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user123" } as any,
      session: null,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
    jest.mocked(safeGetItem).mockReturnValue("1");

    render(<NativeAuthGuard />);

    expect(clearRedirectAttempts).toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("redirects when only auth page check passes but pathname is not auth", () => {
    jest.mocked(usePathname).mockReturnValue("/map");

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/auth/sign-in?redirectTo=%2Fmap"
    );
  });

  it("handles URL encoding for special characters in redirectTo", () => {
    jest.mocked(usePathname).mockReturnValue("/beach/ca/san-diego/blacks");

    render(<NativeAuthGuard />);

    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/auth/sign-in?redirectTo=%2Fbeach%2Fca%2Fsan-diego%2Fblacks"
    );
  });

  it("resets hasRedirected ref when user authenticates", () => {
    // First render: unauthenticated — triggers redirect
    const { rerender } = render(<NativeAuthGuard />);
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);

    // User authenticates — ref should reset
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user123" } as any,
      session: null,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
    rerender(<NativeAuthGuard />);
    expect(clearRedirectAttempts).toHaveBeenCalled();

    // User becomes unauthenticated again — should redirect again
    mockRouterReplace.mockClear();
    jest.mocked(incrementRedirectAttempt).mockClear();
    jest.mocked(isRedirectLoopDetected).mockReturnValue(false);
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      session: null,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
    rerender(<NativeAuthGuard />);
    expect(mockRouterReplace).toHaveBeenCalledWith("/auth/sign-in");
  });
});
