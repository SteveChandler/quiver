import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@/__tests__/setup/test-utils";
import InboxPage from "@/app/inbox/page";

describe("InboxPage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Ensure IntersectionObserver is mocked for Next.js use-intersection
    const io = require("@/__tests__/setup/test-utils");
    io.mockIntersectionObserver();
  });

  it("shows loading then empty state", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { invitations: [] } }),
    } as any);

    render(<InboxPage />);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/No pending invitations/)).toBeInTheDocument()
    );
  });

  it("shows error state when API fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "Boom" }),
    } as any);

    render(<InboxPage />);
    await waitFor(() =>
      expect(
        screen.getByText(
          /Failed to load notifications|Failed to fetch invitations|Boom/
        )
      ).toBeInTheDocument()
    );
  });

  it("renders pending invites and handles respond actions", async () => {
    const pending = [
      {
        id: "i1",
        status: "pending",
        created_at: "2024-01-01",
        message: "Join?",
        session: { id: "s1" },
      },
    ];
    global.fetch = jest
      .fn()
      // initial GET
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { invitations: pending } }),
      } as any)
      // PATCH accept
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      } as any)
      // re-fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { invitations: [] } }),
      } as any);

    render(<InboxPage />);
    await waitFor(() => expect(screen.getByText(/Accept/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Accept/));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  });
});
