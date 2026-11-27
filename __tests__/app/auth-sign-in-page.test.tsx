import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import SignInPage from "@/app/auth/sign-in/page";
import SignUpClient from "@/app/auth/sign-up/sign-up-client";

jest.mock("next/navigation", () => ({ useRouter: jest.fn(), useSearchParams: jest.fn() }));
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({ onClose, onDismiss }: { onClose: () => void; onDismiss?: () => void }) => (
    <>
      <button onClick={onClose}>Complete sign in</button>
      <button onClick={onDismiss ?? onClose}>Dismiss</button>
    </>
  ),
}));

it.each([
  ["redirectTo", "/auth/sign-up", "/"],
  ["redirectUrl", "/auth/sign-in?next=/map", "/"],
  ["next", "javascript:alert(1)", "/"],
  ["redirectTo", "//evil.example", "/"],
  ["next", "/map?beach=1", "/map?beach=1"],
])("safely closes sign-in with %s=%s", (key, destination, expected) => {
  const push = jest.fn();
  jest.mocked(useRouter).mockReturnValue({ push } as never);
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ [key]: destination }) as never);
  render(<SignInPage />);
  fireEvent.click(screen.getByRole("button", { name: "Complete sign in" }));
  expect(push).toHaveBeenCalledWith(expected);
});

describe("dismissing a dedicated auth page", () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useRouter).mockReturnValue(router as never);
  });

  it("does not push the protected page again when a redirected sign-in is dismissed", () => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ redirectTo: "/alerts" }) as never);
    render(<SignInPage />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("does not leave sign-up in history when it is dismissed", () => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    render(<SignUpClient />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
