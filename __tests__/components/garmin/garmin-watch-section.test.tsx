import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GarminWatchSection } from "@/components/garmin/garmin-watch-section";

const envelope = (data: unknown, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ success: status < 300, data, error: status < 300 ? undefined : "not_found" }),
} as Response);

describe("GarminWatchSection", () => {
  const fetchMock = jest.fn();
  const devices = { devices: [{ id: "device-1", name: "Forerunner 965", partNumber: "010-02809", linkedAt: "2026-10-17T14:00:00Z", lastSeenAt: null }], problems: [{ importId: "import-1", startedAt: null, status: "needs_beach", reason: null }] };

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("stays completely dark for non-owners, 404, or failed fetches", async () => {
    const nonOwner = render(<GarminWatchSection isOwner={false} />);
    expect(nonOwner.container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
    nonOwner.unmount();

    let resolveMissing!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveMissing = resolve; }));
    const missing = render(<GarminWatchSection isOwner />);
    expect(missing.container).toBeEmptyDOMElement();
    await act(async () => resolveMissing(envelope(null, 404)));
    expect(missing.container).toBeEmptyDOMElement();
    missing.unmount();

    let rejectFailed!: (error: Error) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((_resolve, reject) => { rejectFailed = reject; }));
    const failed = render(<GarminWatchSection isOwner />);
    expect(failed.container).toBeEmptyDOMElement();
    await act(async () => rejectFailed(new Error("network")));
    expect(failed.container).toBeEmptyDOMElement();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows devices and problems, and requires confirmation before unlinking", async () => {
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "DELETE" ? envelope({ unlinked: true }) : envelope(devices),
    ));
    render(<GarminWatchSection isOwner />);

    expect(await screen.findByText("Forerunner 965")).toBeInTheDocument();
    expect(screen.getByText(/Linked: Oct 17, 2026/)).toBeInTheDocument();
    expect(screen.getByText("Last sync: Not synced yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pick a beach/ })).toHaveAttribute("href", "/sessions/imports/import-1");
    fireEvent.click(screen.getByRole("button", { name: "Unlink Forerunner 965" }));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("device-1"), expect.objectContaining({ method: "DELETE" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unlink" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/watch/devices/device-1", expect.objectContaining({ method: "DELETE" }),
    ));
  });

  it("refreshes the device list and resets the embedded form to link a second watch", async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(
      url.includes("confirm") ? envelope({ linked: true, deviceName: "Forerunner 965" }) : envelope({ devices: [], problems: [] }),
    ));
    render(<GarminWatchSection isOwner />);
    const code = await screen.findByRole("textbox", { name: "Six-digit watch code" });
    expect(screen.getByRole("heading", { name: "Link this Garmin watch?", level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    fireEvent.change(code, { target: { value: "482913" } });
    fireEvent.click(screen.getByRole("button", { name: "Link watch" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/garmin/link-codes/482913/confirm", expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/watch/devices")).toHaveLength(2));
    expect(code).toHaveValue("");
    fireEvent.change(code, { target: { value: "593024" } });
    fireEvent.click(screen.getByRole("button", { name: "Link watch" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/garmin/link-codes/593024/confirm", expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/watch/devices")).toHaveLength(3));
  });

  it.each([
    ["no_gps", "This surf has no GPS track."],
    ["bad_time", "This surf's date looks wrong."],
    ["corrupt", "We couldn't read this surf. Try importing it again."],
    ["too_short", "This track is too short to be a surf."],
    ["duplicate", "You've already uploaded this surf."],
    ["unknown_internal_code", "This surf couldn't be imported."],
  ])("shows friendly copy for a failed surf with reason %s", async (reason, message) => {
    fetchMock.mockResolvedValue(envelope({ ...devices, problems: [{ importId: "import-1", startedAt: null, status: "failed", reason }] }));
    render(<GarminWatchSection isOwner />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  });

  it("shows the last sync date for a watch that has synced", async () => {
    fetchMock.mockResolvedValue(envelope({ ...devices, devices: [{ ...devices.devices[0], lastSeenAt: "2026-10-18T14:00:00Z" }] }));
    render(<GarminWatchSection isOwner />);
    expect(await screen.findByText(/Last sync: Oct 18, 2026/)).toBeInTheDocument();
  });
});
