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

  it("clips the note textarea at 240 chars", () => {
    render(
      <CreateDropSheet
        open
        onClose={onClose}
        onCreated={onCreated}
        selectedBeach={{ id: "b1", name: "Fake Beach" }}
      />,
    );
    const note = screen.getByTestId("create-drop-note") as HTMLTextAreaElement;
    const long = "x".repeat(300);
    fireEvent.change(note, { target: { value: long } });
    expect(note.value.length).toBe(240);
    expect(screen.getByTestId("create-drop-note-count").textContent).toBe(
      "240/240",
    );
  });

  it("blocks submit when start/end are inverted", async () => {
    render(
      <CreateDropSheet
        open
        onClose={onClose}
        onCreated={onCreated}
        selectedBeach={{ id: "b1", name: "Fake Beach" }}
      />,
    );
    const starts = screen.getByTestId("create-drop-starts-at") as HTMLInputElement;
    const ends = screen.getByTestId("create-drop-ends-at") as HTMLInputElement;
    fireEvent.change(starts, { target: { value: "2027-01-01T10:00" } });
    fireEvent.change(ends, { target: { value: "2027-01-01T09:00" } });

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
        selectedBeach={{ id: "11111111-1111-1111-1111-111111111111", name: "Fake Beach" }}
      />,
    );
    fireEvent.click(screen.getByTestId("create-drop-submit"));
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith({ id: "d1", share_slug: "abc" });
    });
    expect(onClose).toHaveBeenCalled();
  });
});
