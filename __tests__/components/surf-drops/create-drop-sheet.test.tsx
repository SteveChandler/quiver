import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  CreateDropSheet,
  clampDropWindow,
} from "@/components/surf-drops/create-drop-sheet";

describe("clampDropWindow", () => {
  const NOW = new Date("2026-07-01T12:00:00Z");

  it("returns ISO strings for a valid window", () => {
    const starts = new Date(NOW.getTime() + 30 * 60 * 1000);
    const ends = new Date(starts.getTime() + 60 * 60 * 1000);
    const res = clampDropWindow(starts, ends, NOW);
    expect(res).toEqual({
      ok: true,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    });
  });

  it("rejects windows shorter than 15 minutes", () => {
    const starts = new Date(NOW.getTime() + 30 * 60 * 1000);
    const ends = new Date(starts.getTime() + 5 * 60 * 1000);
    const res = clampDropWindow(starts, ends, NOW);
    expect(res).toMatchObject({ ok: false, message: expect.stringMatching(/15 minutes/i) });
  });

  it("rejects ends_at at or before starts_at", () => {
    const starts = new Date(NOW.getTime() + 30 * 60 * 1000);
    const ends = new Date(starts.getTime());
    const res = clampDropWindow(starts, ends, NOW);
    expect(res).toMatchObject({ ok: false, message: expect.stringMatching(/after start/i) });
  });

  it("rejects starts_at more than 4 days out", () => {
    const starts = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 60 * 60 * 1000);
    const res = clampDropWindow(starts, ends, NOW);
    expect(res).toMatchObject({ ok: false, message: expect.stringMatching(/4 days/i) });
  });
});

describe("CreateDropSheet UI", () => {
  const originalFetch = global.fetch;
  const onClose = jest.fn();
  const onCreated = jest.fn();
  const beach = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Fake Beach",
  };

  function localInputValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return [
      date.getFullYear(),
      "-",
      pad(date.getMonth() + 1),
      "-",
      pad(date.getDate()),
      "T",
      pad(date.getHours()),
      ":",
      pad(date.getMinutes()),
    ].join("");
  }

  beforeEach(() => {
    onClose.mockClear();
    onCreated.mockClear();
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { id: "d1", share_slug: "abc" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders as a non-modal side panel with an automatic forecast summary", () => {
    render(
      <CreateDropSheet
        open
        onClose={onClose}
        onCreated={onCreated}
        selectedBeach={beach}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Drop a spot" })).toHaveAttribute(
      "aria-modal",
      "false",
    );
    expect(screen.queryByTestId("create-drop-note")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-drop-note-count")).not.toBeInTheDocument();
    expect(screen.getByTestId("create-drop-forecast-summary")).toHaveTextContent(
      /Quiver forecast attached for Fake Beach/i,
    );
  });

  it("updates the end time from duration presets", async () => {
    render(
      <CreateDropSheet
        open
        onClose={onClose}
        onCreated={onCreated}
        selectedBeach={beach}
      />,
    );

    const starts = screen.getByTestId("create-drop-starts-at") as HTMLInputElement;
    const startDate = new Date(Date.now() + 60 * 60 * 1000);
    fireEvent.change(starts, { target: { value: localInputValue(startDate) } });
    fireEvent.click(screen.getByTestId("create-drop-duration-120"));
    fireEvent.click(screen.getByTestId("create-drop-submit"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/surf-drops",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const request = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    const startsAt = new Date(body.starts_at);
    const endsAt = new Date(body.ends_at);
    expect(endsAt.getTime() - startsAt.getTime()).toBe(120 * 60 * 1000);
  });

  it("blocks submit when the start is more than four days out", async () => {
    render(
      <CreateDropSheet
        open
        onClose={onClose}
        onCreated={onCreated}
        selectedBeach={beach}
      />,
    );
    const starts = screen.getByTestId("create-drop-starts-at") as HTMLInputElement;
    fireEvent.change(starts, {
      target: { value: localInputValue(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)) },
    });

    const submit = screen.getByTestId("create-drop-submit");
    fireEvent.click(submit);
    await waitFor(() => {
      expect(screen.getByTestId("create-drop-error")).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("submits and returns the share slug on success", async () => {
    render(
      <CreateDropSheet
        open
        onClose={onClose}
        onCreated={onCreated}
        selectedBeach={beach}
      />,
    );
    fireEvent.click(screen.getByTestId("create-drop-submit"));
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "d1",
          share_slug: "abc",
          location_type: "known_spot",
          beach_id: beach.id,
          spot_name: "Fake Beach",
          lat: null,
          lon: null,
          audience: "mutuals",
        }),
      );
    });
    const request = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.note).toMatch(/Quiver forecast attached for Fake Beach/i);
    expect(body.forecast_snapshot).toMatchObject({
      source: "quiver_map",
      location_type: "known_spot",
    });
    expect(onClose).toHaveBeenCalled();
  });
});
