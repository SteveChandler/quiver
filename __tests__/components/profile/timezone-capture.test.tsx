import { render, waitFor } from "@testing-library/react";
import { TimezoneCapture } from "@/components/profile/timezone-capture";

const mockUseAuth = jest.fn();
const mockUseProfileContext = jest.fn();

jest.mock("@/context/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/context/profile-context", () => ({
  useProfileContext: () => mockUseProfileContext(),
}));

describe("TimezoneCapture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    mockUseAuth.mockReturnValue({ user: { id: "user-123" } });
    mockUseProfileContext.mockReturnValue({
      isLoading: false,
      profile: { timezone: null },
    });
  });

  it("posts the browser timezone once for a signed-in user without one", async () => {
    const { rerender } = render(<TimezoneCapture />);
    rerender(<TimezoneCapture />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/user/timezone",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"timezone"'),
      }),
    );
  });

  it.each([
    ["a set timezone", { user: { id: "user-123" }, profile: { timezone: "UTC" }, isLoading: false }],
    ["a signed-out user", { user: null, profile: { timezone: null }, isLoading: false }],
    ["a loading profile", { user: { id: "user-123" }, profile: { timezone: null }, isLoading: true }],
  ])("does not post for %s", (_name, state) => {
    mockUseAuth.mockReturnValue({ user: state.user });
    mockUseProfileContext.mockReturnValue({
      isLoading: state.isLoading,
      profile: state.profile,
    });

    render(<TimezoneCapture />);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("swallows request failures", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"));

    render(<TimezoneCapture />);

    await waitFor(() => expect(sessionStorage.getItem("quiver_timezone_captured_user-123")).toBe("true"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
