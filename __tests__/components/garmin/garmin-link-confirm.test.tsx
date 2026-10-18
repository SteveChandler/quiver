import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GarminLinkConfirm } from "@/components/garmin/garmin-link-confirm";
import GarminLinkPage, { dynamic, metadata } from "@/app/sessions/garmin-link/page";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("next/navigation", () => ({ redirect: jest.fn(() => { throw new Error("redirected"); }) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: jest.fn() }));

const envelope = (status: number, data?: unknown, error = status === 409 ? "already_confirmed" : "not_found"): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => status < 300 ? { success: true, data } : { success: false, error },
} as Response);

describe("GarminLinkConfirm", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("confirms a watch code and shows the linked device", async () => {
    fetchMock.mockResolvedValue(envelope(200, { linked: true, deviceName: "Forerunner 965" }));
    render(<GarminLinkConfirm initialCode="482913" />);

    expect(screen.getByRole("heading", { name: "Link this Garmin watch?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Link watch" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/garmin/link-codes/482913/confirm",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    ));
    expect(await screen.findByText(/Forerunner 965/)).toBeInTheDocument();
  });

  it("accepts a six-digit code entered on the page", async () => {
    fetchMock.mockResolvedValue(envelope(200, { linked: true, deviceName: "Garmin watch" }));
    render(<GarminLinkConfirm initialCode={null} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Six-digit watch code" }), { target: { value: "482913" } });
    fireEvent.click(screen.getByRole("button", { name: "Link watch" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/garmin/link-codes/482913/confirm", expect.anything(),
    ));
  });

  it.each([
    [404, "not_found", "That code expired. Start again on your watch."],
    [404, "unavailable", "Garmin watches aren't available yet"],
    [409, "already_confirmed", "That code expired. Start again on your watch."],
  ])("shows the appropriate state for HTTP %s %s", async (status, error, message) => {
    fetchMock.mockResolvedValue(envelope(status, undefined, error));
    render(<GarminLinkConfirm initialCode="482913" />);
    fireEvent.click(screen.getByRole("button", { name: "Link watch" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("sanitizes the initial code to at most six digits", () => {
    render(<GarminLinkConfirm initialCode="abc482-91399" />);
    expect(screen.getByRole("textbox", { name: "Six-digit watch code" })).toHaveValue("482913");
    expect(screen.getByRole("button", { name: "Link watch" })).toBeEnabled();
  });

  it("explains an incomplete initial code and prevents submitting it", () => {
    render(<GarminLinkConfirm initialCode="ab12-3" />);
    expect(screen.getByRole("textbox", { name: "Six-digit watch code" })).toHaveValue("123");
    expect(screen.getByText("Enter the six-digit code shown on your watch.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link watch" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

it("keeps the watch code and other query parameters through the signed-out redirect", async () => {
  jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } } as never);
  await expect(GarminLinkPage({ searchParams: Promise.resolve({ code: "482913", source: "watch" }) })).rejects.toThrow("redirected");
  expect(redirect).toHaveBeenCalledWith("/auth/sign-in?redirectTo=%2Fsessions%2Fgarmin-link%3Fcode%3D482913%26source%3Dwatch");
  expect(dynamic).toBe("force-dynamic");
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.title).toBe("Link Garmin watch");
});
