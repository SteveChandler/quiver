/** @jest-environment node */
import { NextRequest } from "next/server";
import { promises as dnsPromises } from "dns";
import { GET } from "@/app/api/image-proxy/route";

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit: (handler: unknown) => handler,
}));
jest.mock("dns", () => ({ promises: { resolve4: jest.fn() } }));

const imageUrl = "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Kaanapali_Beach_Maui.jpg/960px-Kaanapali_Beach_Maui.jpg";
const mockResolve = dnsPromises.resolve4 as jest.Mock;

function request(url: string): NextRequest {
  return new NextRequest(`https://www.quiversurf.app/api/image-proxy?url=${encodeURIComponent(url)}`);
}

describe("Wikimedia image proxy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockReset().mockResolvedValue(["208.80.154.240"]);
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer,
    } as Response);
  });
  afterEach(() => jest.restoreAllMocks());

  it("serves the Commons thumbnail after public DNS validation", async () => {
    const response = await GET(request(imageUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([255, 216, 255]));
    expect(mockResolve).toHaveBeenCalledWith("thumb.wikimedia.org");
    expect(fetch).toHaveBeenCalledWith(imageUrl, expect.any(Object));
  });

  it("rejects a lookalike host before fetching", async () => {
    const response = await GET(request(imageUrl.replace("thumb.wikimedia.org", "thumb.wikimedia.org.evil.example")));
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects the allowed host when DNS resolves to a private address", async () => {
    mockResolve.mockResolvedValue(["127.0.0.1"]);
    const response = await GET(request(imageUrl));
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});
