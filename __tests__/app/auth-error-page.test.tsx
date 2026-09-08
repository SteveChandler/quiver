import { render, screen } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import ErrorPage from "@/app/error/page";

jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }));

it.each(["", "&flow=confirmation"])("offers sign-in instead of password recovery for confirmation failures %s", (flow) => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(`reason=invalid_or_expired_link${flow}`) as never);
  render(<ErrorPage />);
  expect(screen.getByText("Unable to Confirm Email")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/auth/sign-in");
  expect(screen.queryByRole("link", { name: "Request New Reset Link" })).not.toBeInTheDocument();
});

it("preserves the password recovery action for recovery links", () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("reason=invalid_or_expired_link&flow=recovery") as never);
  render(<ErrorPage />);
  expect(screen.getByRole("link", { name: "Request New Reset Link" })).toHaveAttribute("href", "/auth/forgot-password");
});
