import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportBeachPage } from "@/components/garmin/import-beach-page";
import SessionImportPage, { dynamic, metadata } from "@/app/sessions/imports/[id]/page";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("next/navigation", () => ({ redirect: jest.fn(() => { throw new Error("redirected"); }) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: jest.fn() }));

jest.mock("@/components/sessions/import/import-beach-picker", () => ({
  ImportBeachPicker: ({ candidates, onChoose }: { candidates: { id: string; name: string }[]; onChoose: (id: string) => Promise<void> }) => (
    <div>{candidates.map((beach) => <button key={beach.id} onClick={() => void onChoose(beach.id)}>{beach.name}</button>)}</div>
  ),
}));

const envelope = (data: unknown, status = 200, error = "not_found", details?: unknown): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ success: status < 300, data, error: status < 300 ? undefined : error, details }),
} as Response);

describe("ImportBeachPage", () => {
  const fetchMock = jest.fn();
  const imported = {
    id: "import-1", status: "needs_beach", origin: "garmin_watch", startedAt: "2026-10-17T14:00:00Z",
    candidates: [{ id: "beach-1", name: "Ocean Beach", lat: 32.7, lon: -117.2, swellWindowCenterDeg: null }], sessionId: null,
  };

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("loads candidates, saves the beach, and links the completed session", async () => {
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "POST" ? envelope({ status: "completed", sessionId: "session-1" }) : envelope(imported),
    ));
    render(<ImportBeachPage importId="import-1" />);

    expect(await screen.findByRole("heading", { name: "Pick the beach for your Oct 17 surf" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocean Beach" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/session-imports/import-1/beach",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ beachId: "beach-1" }) }),
    ));
    expect(await screen.findByRole("link", { name: "View session" })).toHaveAttribute("href", "/sessions/session-1");
  });

  it("offers the session when the import was already completed", async () => {
    fetchMock.mockResolvedValue(envelope({ ...imported, status: "completed", sessionId: "session-2" }));
    render(<ImportBeachPage importId="import-1" />);
    expect(await screen.findByRole("link", { name: "View session" })).toHaveAttribute("href", "/sessions/session-2");
    expect(screen.queryByText("Ocean Beach")).not.toBeInTheDocument();
  });

  it.each([
    ["too_short", "This track is too short to be a surf."],
    ["duplicate", "You've already uploaded this surf."],
    ["unknown_internal_code", "This surf couldn't be imported."],
  ])("shows friendly copy for failed import reason %s", async (reason, message) => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(url === "/api/v1/watch/devices"
      ? envelope({ devices: [], problems: [{ importId: "import-1", startedAt: null, status: "failed", reason }] })
      : envelope({ ...imported, status: "failed" })));
    render(<ImportBeachPage importId="import-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  });

  it("refetches a 422 beach failure and shows the failed import", async () => {
    let failed = false;
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        failed = true;
        return Promise.resolve(envelope(null, 422, "too_short"));
      }
      return Promise.resolve(envelope(failed ? { ...imported, status: "failed", reason: "too_short" } : imported));
    });
    render(<ImportBeachPage importId="import-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ocean Beach" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This track is too short to be a surf.");
    expect(fetchMock.mock.calls.filter(([url, options]) => url === "/api/v1/session-imports/import-1" && !options?.method)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Ocean Beach" })).not.toBeInTheDocument();
  });

  it("links to the existing session when beach confirmation finds a duplicate", async () => {
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST"
      ? envelope(null, 409, "duplicate", { sessionId: "existing-session" })
      : envelope(imported)));
    render(<ImportBeachPage importId="import-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ocean Beach" }));
    expect(await screen.findByRole("link", { name: "View session" })).toHaveAttribute("href", "/sessions/existing-session");
    expect(screen.queryByRole("button", { name: "Ocean Beach" })).not.toBeInTheDocument();
  });

  it("formats the surf date in the browser's time zone", async () => {
    const formatDate = jest.spyOn(Date.prototype, "toLocaleDateString");
    fetchMock.mockResolvedValue(envelope(imported));
    try {
      render(<ImportBeachPage importId="import-1" />);
      await screen.findByRole("button", { name: "Ocean Beach" });
      expect(formatDate).toHaveBeenCalledWith("en-US", { month: "short", day: "numeric" });
    } finally {
      formatDate.mockRestore();
    }
  });
});

it("keeps the import URL through the signed-out redirect", async () => {
  jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } } as never);
  await expect(SessionImportPage({ params: Promise.resolve({ id: "import-1" }), searchParams: Promise.resolve({ from: "watch" }) })).rejects.toThrow("redirected");
  expect(redirect).toHaveBeenCalledWith("/auth/sign-in?redirectTo=%2Fsessions%2Fimports%2Fimport-1%3Ffrom%3Dwatch");
  expect(dynamic).toBe("force-dynamic");
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.title).toBe("Finish surf import");
});
