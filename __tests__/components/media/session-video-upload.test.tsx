import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SessionVideoUpload } from "@/components/media/session-video-upload";

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-id" } }),
}));

const upload = jest.fn();
const remove = jest.fn();
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ upload, remove }) } }),
}));

/**
 * The component probes real duration by creating a <video>, assigning .src and
 * waiting on .onloadedmetadata. jsdom never loads media, so intercept
 * createElement("video") and fire the handler as soon as src is set.
 */
function stubDurationProbe(seconds: number) {
  const real = document.createElement.bind(document);
  jest.spyOn(document, "createElement").mockImplementation((tag: string, ...rest: unknown[]) => {
    if (tag !== "video") return real(tag, ...(rest as []));
    const el: Record<string, unknown> = {
      preload: "",
      duration: seconds,
      onloadedmetadata: null,
      onerror: null,
      removeAttribute: () => {},
      load: () => {},
    };
    Object.defineProperty(el, "src", {
      set() {
        setTimeout(() => (el.onloadedmetadata as (() => void) | null)?.(), 0);
      },
    });
    return el as unknown as HTMLElement;
  });
}

const pick = async (name = "clip.mp4") => {
  const file = new File(["x".repeat(1024)], name, { type: "video/mp4" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect((screen.getByRole("button", { name: /upload session clip/i }) as HTMLButtonElement).disabled).toBe(false)
  );
};

describe("SessionVideoUpload", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    upload.mockReset();
    remove.mockReset();
    URL.createObjectURL = jest.fn(() => "blob:clip");
    URL.revokeObjectURL = jest.fn();
    stubDurationProbe(12);
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it("uploads to {sessionId}/{userId}/ and does not clean up on success", async () => {
    upload.mockResolvedValue({ error: null });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 201, json: async () => ({ mediaId: "m1" }) });

    render(<SessionVideoUpload sessionId="session-1" />);
    await pick();
    fireEvent.click(screen.getByRole("button", { name: /upload session clip/i }));

    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(upload.mock.calls[0][0]).toMatch(/^session-1\/user-id\//);
    await waitFor(() => expect(screen.getByText(/pending moderation/i)).toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes the orphaned object when finalize fails", async () => {
    upload.mockResolvedValue({ error: null });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });

    render(<SessionVideoUpload sessionId="session-1" />);
    await pick();
    fireEvent.click(screen.getByRole("button", { name: /upload session clip/i }));

    // the object reached storage but no row owns it — it must be reclaimed
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    const [removedPaths] = remove.mock.calls[0];
    expect(removedPaths).toEqual([upload.mock.calls[0][0]]);
  });

  it("does not attempt cleanup when the storage upload itself failed", async () => {
    upload.mockResolvedValue({ error: { message: "denied" } });

    render(<SessionVideoUpload sessionId="session-1" />);
    await pick();
    fireEvent.click(screen.getByRole("button", { name: /upload session clip/i }));

    await waitFor(() => expect(screen.getByText(/could not be uploaded/i)).toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
  });

  it("surfaces the original error even if cleanup itself fails", async () => {
    upload.mockResolvedValue({ error: null });
    remove.mockRejectedValue(new Error("cleanup exploded"));
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });

    render(<SessionVideoUpload sessionId="session-1" />);
    await pick();
    fireEvent.click(screen.getByRole("button", { name: /upload session clip/i }));

    await waitFor(() => expect(remove).toHaveBeenCalled());
    expect(screen.queryByText(/cleanup exploded/i)).not.toBeInTheDocument();
  });
});
