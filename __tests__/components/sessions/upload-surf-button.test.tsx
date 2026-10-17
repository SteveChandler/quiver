import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadSurfButton } from "@/components/sessions/import/upload-surf-button";
import SessionsPage from "@/app/sessions/page";

const push = jest.fn();
const successToast = jest.fn();
const upload = jest.fn();
const mockUseDataFetcher = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => successToast(...args) } }));
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ upload }) } }),
}));
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isLoading: false }),
}));
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: (...args: unknown[]) => mockUseDataFetcher(...args),
}));
jest.mock("@/components/ui/public-content-gate", () => ({
  PublicContentGate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("next/link", () => ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>);
jest.mock("next/image", () => (props: { alt: string }) => <span role="img" aria-label={props.alt} />);
jest.mock("@/components/BeachSelector", () => ({
  BeachSelector: ({ onBeachSelected }: { onBeachSelected: (beach: { id: string; name: string }) => void }) => (
    <button type="button" onClick={() => onBeachSelected({ id: "searched-beach", name: "Searched Beach" })}>
      Search result
    </button>
  ),
}));

const envelope = (data: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => ({ success: true, data, timestamp: "now" }) }) as Response;

const errorEnvelope = (error: string, status: number, details?: unknown): Response =>
  ({ ok: false, status, json: async () => ({ success: false, error, details, timestamp: "now" }) }) as Response;

function file(name = "surf.gpx"): File {
  return new File(["track"], name, { type: "text/plain" });
}

async function selectFile(name = "surf.gpx"): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Upload a surf (FIT or GPX)" }));
  await user.upload(screen.getByLabelText("Surf file"), file(name));
}

beforeEach(() => {
  jest.clearAllMocks();
  upload.mockResolvedValue({ error: null });
  mockUseDataFetcher.mockReturnValue({ data: { sessions: [], sessionImportsEnabled: false, forUserId: "user-1" }, loading: false, error: null, retry: jest.fn() });
});

describe("UploadSurfButton", () => {
  it("uploads to session-tracks and navigates after processing", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(envelope({ importId: "import-1", uploadPath: "import-1/user-1/surf.gpx" }, 201))
      .mockResolvedValueOnce(envelope({ status: "completed", sessionId: "session-1", attached: true, summary: { waveCount: 4 } }))
      .mockResolvedValueOnce(envelope({ session: { beach_name: "Pipes", arrival_time: "2026-10-17T12:00:00" } }));
    global.fetch = fetchMock;

    render(<UploadSurfButton enabled />);
    await selectFile();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sessions/session-1"));
    expect(upload).toHaveBeenCalledWith("import-1/user-1/surf.gpx", expect.any(File), {
      contentType: "application/gpx+xml", upsert: false,
    });
    expect(successToast).toHaveBeenCalledWith("Added 4 waves to your Oct 17 session at Pipes");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/session-imports", expect.objectContaining({
      method: "POST", body: JSON.stringify({ filename: "surf.gpx" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/session-imports/import-1/process", expect.objectContaining({ method: "POST" }));
  });

  it("shows candidate beaches, then posts the chosen beach", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(envelope({ importId: "import-2", uploadPath: "import-2/user-1/surf.fit" }, 201))
      .mockResolvedValueOnce(envelope({ status: "needs_beach", importId: "import-2", candidates: [{ id: "pipes", name: "Pipes", lat: 1, lon: 2, swellWindowCenterDeg: null }] }, 202))
      .mockResolvedValueOnce(envelope({ status: "completed", sessionId: "session-2", attached: false, summary: { waveCount: 2 } }))
      .mockResolvedValueOnce(envelope({ session: { beach_name: "Pipes", arrival_time: "2026-10-17T12:00:00" } }));
    global.fetch = fetchMock;

    render(<UploadSurfButton enabled />);
    await selectFile("surf.fit");
    expect(await screen.findByRole("button", { name: "Pipes" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pipes" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sessions/session-2"));
    expect(upload).toHaveBeenCalledWith("import-2/user-1/surf.fit", expect.any(File), {
      contentType: "application/octet-stream", upsert: false,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/v1/session-imports/import-2/beach", expect.objectContaining({
      method: "POST", body: JSON.stringify({ beachId: "pipes" }),
    }));
    expect(successToast).toHaveBeenCalledWith("New session at Pipes: 2 waves");
  });

  it("shows the no GPS error", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(envelope({ importId: "import-3", uploadPath: "import-3/user-1/surf.zip" }, 201))
      .mockResolvedValueOnce(errorEnvelope("no_gps", 422));

    render(<UploadSurfButton enabled />);
    await selectFile("surf.zip");
    expect(await screen.findByText("This file has no GPS track.")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith("import-3/user-1/surf.zip", expect.any(File), {
      contentType: "application/zip", upsert: false,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("links to the existing session on a duplicate", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(envelope({ importId: "import-4", uploadPath: "import-4/user-1/surf.fit" }, 201))
      .mockResolvedValueOnce(errorEnvelope("duplicate", 409, { sessionId: "existing-session" }));

    render(<UploadSurfButton enabled />);
    await selectFile("surf.fit");

    expect(await screen.findByText("You've already uploaded this surf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the existing session" })).toHaveAttribute("href", "/sessions/existing-session");
    expect(push).not.toHaveBeenCalled();
  });

  it("is absent when disabled", () => {
    render(<UploadSurfButton enabled={false} />);
    expect(screen.queryByRole("button", { name: "Upload a surf (FIT or GPX)" })).not.toBeInTheDocument();
  });

  it("hides the upload action on /sessions until the owner flag is enabled", () => {
    const { rerender } = render(<SessionsPage />);
    expect(screen.queryByRole("button", { name: "Upload a surf (FIT or GPX)" })).not.toBeInTheDocument();

    mockUseDataFetcher.mockReturnValue({ data: { sessions: [], sessionImportsEnabled: true, forUserId: "other-user" }, loading: false, error: null, retry: jest.fn() });
    rerender(<SessionsPage />);
    expect(screen.queryByRole("button", { name: "Upload a surf (FIT or GPX)" })).not.toBeInTheDocument();

    mockUseDataFetcher.mockReturnValue({ data: { sessions: [], sessionImportsEnabled: true, forUserId: "user-1" }, loading: false, error: null, retry: jest.fn() });
    rerender(<SessionsPage />);
    expect(screen.getByRole("button", { name: "Upload a surf (FIT or GPX)" })).toBeInTheDocument();
  });

  it("shows a waves badge for an owner's tracked session", () => {
    mockUseDataFetcher.mockReturnValue({
      data: {
        sessions: [{ id: "session-1", beachName: "Pipes", hasTrack: true }],
        sessionImportsEnabled: false,
        forUserId: "user-1",
      },
      loading: false,
      error: null,
      retry: jest.fn(),
    });

    render(<SessionsPage />);
    expect(screen.getByText("Waves")).toBeInTheDocument();
  });
});
