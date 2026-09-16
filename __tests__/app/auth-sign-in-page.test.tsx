import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import SignInPage from "@/app/auth/sign-in/page";

jest.mock("next/navigation", () => ({ useRouter: jest.fn(), useSearchParams: jest.fn() }));
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Complete sign in</button>,
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
