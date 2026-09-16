import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OfferClaimForm } from "@/app/offers/claim/claim-form";

const originalFetch = global.fetch;
let fetchMock: jest.Mock;
beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
afterEach(() => { global.fetch = originalFetch; });
it("shows the exact duration and requires a second explicit action to grant", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "preview", months: 3, terms_version: "v1", state: "enrolled", completed_sessions: 0 }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "verified", mirror_verified: true, expires_at: "2027-01-01T00:00:00Z" }) });
  render(<OfferClaimForm enabled />);
  fireEvent.change(screen.getByLabelText("Your offer code"), { target: { value: "a".repeat(43) } });
  fireEvent.click(screen.getByRole("button", { name: "Review my offer" }));
  expect(await screen.findByText(/three calendar months/)).toBeVisible(); expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).mode).toBe("preview");
  fireEvent.click(screen.getByRole("button", { name: "Confirm and claim Pro" }));
  await screen.findByText(/Your Pro offer is confirmed/);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).mode).toBe("claim");
  expect(screen.getByLabelText("Your offer code")).toHaveValue("");
});
it("editing the token invalidates the reviewed duration", async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "preview", months: 1, terms_version: "v1", state: "enrolled", completed_sessions: 0 }) });
  render(<OfferClaimForm enabled />); const input = screen.getByLabelText("Your offer code");
  fireEvent.change(input, { target: { value: "a".repeat(43) } }); fireEvent.click(screen.getByRole("button", { name: "Review my offer" }));
  await screen.findByText(/one calendar month/);
  fireEvent.change(input, { target: { value: "b".repeat(43) } });
  expect(screen.getByRole("button", { name: "Review my offer" })).toBeEnabled();
});
it("auth failure offers the existing return-to route without placing the token in a URL", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401 }); render(<OfferClaimForm enabled />);
  fireEvent.change(screen.getByLabelText("Your offer code"), { target: { value: "a".repeat(43) } });
  fireEvent.click(screen.getByRole("button", { name: "Review my offer" }));
  await waitFor(() => expect(screen.getByRole("link", { name: "Sign in to claim" })).toHaveAttribute("href", "/auth/sign-in?redirectTo=%2Foffers%2Fclaim"));
});
it("a network failure never claims the award was granted", async () => {
  fetchMock.mockRejectedValue(Error("offline")); render(<OfferClaimForm enabled />);
  fireEvent.change(screen.getByLabelText("Your offer code"), { target: { value: "a".repeat(43) } });
  fireEvent.click(screen.getByRole("button", { name: "Review my offer" }));
  await screen.findByText(/could not confirm/); expect(screen.queryByText(/is confirmed/)).not.toBeInTheDocument();
});

it("does not confirm malformed provider confirmation data", async () => {
  fetchMock.mockResolvedValue({ok:true,status:200,json:async () => ({status:"verified",expires_at:"2027-01-01T00:00:00Z"})});
  render(<OfferClaimForm enabled />);
  fireEvent.change(screen.getByLabelText("Your offer code"), {target:{value:"a".repeat(43)}});
  fireEvent.click(screen.getByRole("button",{name:"Review my offer"}));
  await screen.findByText(/could not confirm/);
  expect(screen.queryByText(/is confirmed/)).not.toBeInTheDocument();
});
