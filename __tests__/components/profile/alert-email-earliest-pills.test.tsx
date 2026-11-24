import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AlertEmailEarliestPills } from "@/components/profile/alert-email-earliest-pills";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const mockFetch = jest.fn();
const mockToastError = jest.fn();
jest.mock("@/lib/fetch-with-auth-retry", () => ({ fetchWithAuthRetry: (...args: unknown[]) => mockFetch(...args) }));
jest.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args) } }));

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const pill = (name: string) => screen.getByRole("button", { name });

beforeEach(() => { mockFetch.mockReset(); mockToastError.mockReset(); });

it("keeps the pills disabled until the setting loads, then marks the saved value", async () => {
  let resolve: (value: unknown) => void = () => {};
  mockFetch.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  render(<AlertEmailEarliestPills />);
  expect(pill("9 AM")).toBeDisabled();
  expect(pill("9 AM")).toHaveAttribute("aria-pressed", "true");
  resolve(ok({ earliest: "06:00", supported: true }));
  await waitFor(() => expect(pill("6 AM")).toBeEnabled());
  expect(pill("6 AM")).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Dawn windows need an early heads-up. Other emails still come in the day.")).toBeInTheDocument();
  expect(screen.getAllByRole("button").map(b => b.textContent)).toEqual(["5 AM", "6 AM", "7 AM", "9 AM"]);
});

it("saves a tap and keeps it", async () => {
  mockFetch.mockResolvedValueOnce(ok({ earliest: "09:00", supported: true })).mockResolvedValueOnce(ok({ earliest: "05:00", supported: true }));
  render(<AlertEmailEarliestPills />);
  await waitFor(() => expect(pill("5 AM")).toBeEnabled());
  fireEvent.click(pill("5 AM"));
  await waitFor(() => expect(pill("5 AM")).toBeEnabled());
  expect(pill("5 AM")).toHaveAttribute("aria-pressed", "true");
  expect(mockFetch).toHaveBeenLastCalledWith("/api/profile/alert-email-earliest", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ earliest: "05:00" }) }));
  expect(mockToastError).not.toHaveBeenCalled();
});

it("puts the pill back and says so when the save fails", async () => {
  mockFetch.mockResolvedValueOnce(ok({ earliest: "09:00", supported: true })).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
  render(<AlertEmailEarliestPills />);
  await waitFor(() => expect(pill("7 AM")).toBeEnabled());
  fireEvent.click(pill("7 AM"));
  await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Setting not saved"));
  await waitFor(() => expect(pill("9 AM")).toHaveAttribute("aria-pressed", "true"));
  expect(pill("7 AM")).toHaveAttribute("aria-pressed", "false");
  expectConsoleWarnings([/save failed/]);
});

it("shows nothing before the column exists or when the setting cannot load", async () => {
  mockFetch.mockResolvedValueOnce(ok({ earliest: "09:00", supported: false }));
  const { unmount } = render(<AlertEmailEarliestPills />);
  await waitFor(() => expect(screen.queryByTestId("alert-email-earliest")).not.toBeInTheDocument());
  unmount();
  mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
  render(<AlertEmailEarliestPills />);
  await waitFor(() => expect(screen.queryByTestId("alert-email-earliest")).not.toBeInTheDocument());
  expectConsoleWarnings([/load failed/]);
});
