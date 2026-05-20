import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppleBetaPrompt } from "@/components/app-store/apple-beta-prompt";
import {
  APPLE_BETA_PROMPT_COOKIE,
  APPLE_BETA_PROMPT_COOKIE_VALUE,
  APPLE_BETA_PROMPT_PENDING_STORAGE_KEY,
} from "@/lib/app-store/apple-beta-prompt";
import {
  IOS_TESTFLIGHT_BETA_CTA,
  IOS_TESTFLIGHT_BETA_URL,
} from "@/lib/constants/app-store";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/components/ui/use-toast";

const mockTrack = jest.fn();
const mockOnboardingState = { isOpen: false };

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("@/store/onboarding-store", () => ({
  useOnboardingStore: jest.fn((selector) => selector(mockOnboardingState)),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/map",
}));

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function setUserAgent(userAgent: string, maxTouchPoints = 0): void {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    value: maxTouchPoints,
    configurable: true,
  });
}

function setPromptCookie(): void {
  document.cookie = `${APPLE_BETA_PROMPT_COOKIE}=${APPLE_BETA_PROMPT_COOKIE_VALUE}; path=/`;
}

function clearPromptCookie(): void {
  document.cookie = `${APPLE_BETA_PROMPT_COOKIE}=; Max-Age=0; path=/`;
}

describe("AppleBetaPrompt", () => {
  const mockedUseAuth = useAuth as jest.Mock;
  const mockedToast = toast as jest.Mock;
  const mockActivityChange = jest.fn();
  const mockWriteText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearPromptCookie();
    mockOnboardingState.isOpen = false;
    mockedUseAuth.mockReturnValue({ user: { id: "user-1" } });
    setUserAgent(DESKTOP_UA);
    mockWriteText.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
    });
  });

  it("renders desktop QR prompt with exact copy, logo, and analytics", async () => {
    setPromptCookie();

    render(<AppleBetaPrompt onPromptActivityChange={mockActivityChange} />);

    expect(
      await screen.findByText(
        "Want to join the iOS beta? The app is better for surf alerts, quick checks and logging sessions after you paddle out."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Scan with your iPhone camera")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy beta link/i })
    ).toBeInTheDocument();

    const qr = screen.getByTestId("apple-beta-prompt-qr");
    const logo = qr.querySelector("image");
    expect(logo).toHaveAttribute("href", "/quiver-app-icon-128.png");

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        "apple_beta_prompt_viewed",
        expect.objectContaining({
          metadata: expect.objectContaining({
            has_qr: true,
            testflight_url: IOS_TESTFLIGHT_BETA_URL,
          }),
          debounceMs: 0,
        })
      );
      expect(mockTrack).toHaveBeenCalledWith(
        "apple_beta_prompt_qr_rendered",
        expect.objectContaining({
          metadata: expect.objectContaining({
            qr_logo: "quiver-app-icon-128",
          }),
          debounceMs: 0,
        })
      );
    });

    expect(mockActivityChange).toHaveBeenLastCalledWith(true);
  });

  it("opens TestFlight directly on iPhone and clears pending state", async () => {
    setUserAgent(IPHONE_UA);
    setPromptCookie();

    render(<AppleBetaPrompt />);

    const link = await screen.findByRole("link", {
      name: IOS_TESTFLIGHT_BETA_CTA,
    });
    expect(link).toHaveAttribute("href", IOS_TESTFLIGHT_BETA_URL);
    expect(screen.queryByTestId("apple-beta-prompt-qr")).not.toBeInTheDocument();

    fireEvent.click(link);

    expect(mockTrack).toHaveBeenCalledWith(
      "apple_beta_prompt_open_testflight_clicked",
      expect.objectContaining({
        metadata: expect.objectContaining({
          device_mode: "ios_direct",
          platform_guess: "ios",
          destination_url: IOS_TESTFLIGHT_BETA_URL,
        }),
        debounceMs: 0,
      })
    );
    expect(
      window.sessionStorage.getItem(APPLE_BETA_PROMPT_PENDING_STORAGE_KEY)
    ).toBeNull();
  });

  it("copies the beta link on desktop and tracks the action", async () => {
    setPromptCookie();
    render(<AppleBetaPrompt />);

    fireEvent.click(await screen.findByRole("button", { name: /copy beta link/i }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(IOS_TESTFLIGHT_BETA_URL);
    });
    expect(mockTrack).toHaveBeenCalledWith(
      "apple_beta_prompt_copy_link_clicked",
      expect.objectContaining({
        metadata: expect.objectContaining({
          device_mode: "desktop_qr",
          destination_url: IOS_TESTFLIGHT_BETA_URL,
        }),
        debounceMs: 0,
      })
    );
    expect(
      window.sessionStorage.getItem(APPLE_BETA_PROMPT_PENDING_STORAGE_KEY)
    ).toBeNull();
  });

  it("keeps the QR prompt open when clipboard copy fails", async () => {
    mockWriteText.mockRejectedValue(new Error("clipboard denied"));
    setPromptCookie();
    render(<AppleBetaPrompt />);

    fireEvent.click(await screen.findByRole("button", { name: /copy beta link/i }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(IOS_TESTFLIGHT_BETA_URL);
    });
    expect(mockedToast).toHaveBeenCalledWith({
      title: "Could not copy link",
      description: "Scan the QR code with your iPhone camera.",
    });
    expect(screen.getByTestId("apple-beta-prompt")).toBeInTheDocument();
    expect(
      window.sessionStorage.getItem(APPLE_BETA_PROMPT_PENDING_STORAGE_KEY)
    ).toBe(APPLE_BETA_PROMPT_COOKIE_VALUE);
  });

  it("tracks dismissals and clears pending state", async () => {
    setPromptCookie();
    render(<AppleBetaPrompt />);

    fireEvent.click(await screen.findByRole("button", { name: /not now/i }));

    expect(mockTrack).toHaveBeenCalledWith(
      "apple_beta_prompt_dismissed",
      expect.objectContaining({
        metadata: expect.objectContaining({
          dismiss_reason: "not_now",
        }),
        debounceMs: 0,
      })
    );
    expect(
      window.sessionStorage.getItem(APPLE_BETA_PROMPT_PENDING_STORAGE_KEY)
    ).toBeNull();
  });

  it("suppresses the iPhone banner while auth is hydrating for a pending prompt", async () => {
    mockedUseAuth.mockReturnValue({ user: null });
    setPromptCookie();

    render(<AppleBetaPrompt onPromptActivityChange={mockActivityChange} />);

    await waitFor(() => {
      expect(mockActivityChange).toHaveBeenLastCalledWith(true);
    });
    expect(screen.queryByTestId("apple-beta-prompt")).not.toBeInTheDocument();
  });

  it("does not render without a pending Apple prompt cookie", async () => {
    render(<AppleBetaPrompt />);

    await waitFor(() => {
      expect(screen.queryByTestId("apple-beta-prompt")).not.toBeInTheDocument();
    });
  });

  it("defers while onboarding is open", async () => {
    mockOnboardingState.isOpen = true;
    setPromptCookie();

    render(<AppleBetaPrompt onPromptActivityChange={mockActivityChange} />);

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByTestId("apple-beta-prompt")).not.toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalledWith(
      "apple_beta_prompt_viewed",
      expect.anything()
    );
    expect(mockActivityChange).toHaveBeenLastCalledWith(true);
  });
});
