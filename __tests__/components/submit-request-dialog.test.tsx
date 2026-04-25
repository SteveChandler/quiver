import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SubmitRequestDialog } from "@/components/roadmap/SubmitRequestDialog";

describe("<SubmitRequestDialog/>", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("renders hidden when open=false", () => {
    render(<SubmitRequestDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText(/suggest something/i)).not.toBeInTheDocument();
  });

  it("renders visible with form fields when open=true", () => {
    render(<SubmitRequestDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText(/suggest something/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send it/i })).toBeInTheDocument();
  });

  it("disables submit when title is empty", () => {
    render(<SubmitRequestDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByRole("button", { name: /send it/i })).toBeDisabled();
  });

  it("disables submit when only title+description filled but no category", () => {
    render(<SubmitRequestDialog open={true} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Watch integration" } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Connect to Apple Health workouts." },
    });
    expect(screen.getByRole("button", { name: /send it/i })).toBeDisabled();
  });

  it("enables submit when title + description + category are all filled", () => {
    render(<SubmitRequestDialog open={true} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Watch integration" } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Connect to Apple Health workouts." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^forecasts$/i }));
    expect(screen.getByRole("button", { name: /send it/i })).not.toBeDisabled();
  });

  it("surfaces duplicate matches when title changes", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [{ id: "a", title: "Apple Watch forecast glance" }] }),
    });
    render(<SubmitRequestDialog open={true} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "watch" } });
    await waitFor(() => {
      expect(screen.getByText("Apple Watch forecast glance")).toBeInTheDocument();
    });
  });

  it("calls POST /api/roadmap/submissions with body + closes on success", async () => {
    const onOpenChange = jest.fn();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ matches: [] }) }) // duplicate-search
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "new-1", decision: "pending" }) }); // submit
    render(<SubmitRequestDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Watch integration" } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Connect to Apple Health workouts." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^forecasts$/i }));
    fireEvent.click(screen.getByRole("button", { name: /send it/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect((global.fetch as jest.Mock).mock.calls.some(
      ([url, init]) => typeof url === "string" && url === "/api/roadmap/submissions" && init?.method === "POST"
    )).toBe(true);
  });

  it("shows error message on failed submit and keeps dialog open", async () => {
    const onOpenChange = jest.fn();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ matches: [] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Title too long" }) });
    render(<SubmitRequestDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Watch integration" } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Connect to Apple Health workouts." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^forecasts$/i }));
    fireEvent.click(screen.getByRole("button", { name: /send it/i }));
    await waitFor(() => {
      expect(screen.getByText(/title too long/i)).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
