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
    const owner = render(<GarminWatchSection isOwner={false} />);
    expect(owner.container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
    owner.unmount();

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
    expect(screen.getByRole("link", { name: /Pick a beach/ })).toHaveAttribute("href", "/sessions/imports/import-1");
    fireEvent.click(screen.getByRole("button", { name: "Unlink Forerunner 965" }));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("device-1"), expect.objectContaining({ method: "DELETE" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unlink" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/watch/devices/device-1", expect.objectContaining({ method: "DELETE" }),
    ));
  });

  it("accepts a six-digit code and refreshes the device list", async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(
      url.includes("confirm") ? envelope({ linked: true, deviceName: "Forerunner 965" }) : envelope({ devices: [], problems: [] }),
    ));
    render(<GarminWatchSection isOwner />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Six-digit watch code" }), { target: { value: "482913" } });
    fireEvent.click(screen.getByRole("button", { name: "Link watch" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/garmin/link-codes/482913/confirm", expect.objectContaining({ method: "POST" }),
    ));
  });
});
