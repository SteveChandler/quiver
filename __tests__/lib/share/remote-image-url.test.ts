import {
  isRemoteImageUrl,
  remoteImageUrlOrFallback,
  remoteImageUrlOrUndefined,
} from "@/lib/share/remote-image-url";

describe("remote image URL helpers", () => {
  it("accepts http and https URLs", () => {
    expect(isRemoteImageUrl("https://cdn.quiversurf.app/session.jpg")).toBe(true);
    expect(isRemoteImageUrl("http://localhost:3000/session.jpg")).toBe(true);
  });

  it("rejects local and malformed URLs", () => {
    expect(isRemoteImageUrl("file:///tmp/session.jpg")).toBe(false);
    expect(isRemoteImageUrl("content://media/external/images/1")).toBe(false);
    expect(isRemoteImageUrl("data:image/png;base64,abc")).toBe(false);
    expect(isRemoteImageUrl("not a url")).toBe(false);
  });

  it("returns a fallback for invalid image URLs", () => {
    expect(remoteImageUrlOrUndefined("file:///tmp/session.jpg")).toBeUndefined();
    expect(remoteImageUrlOrFallback("file:///tmp/session.jpg", "https://example.com/default.jpg")).toBe(
      "https://example.com/default.jpg"
    );
  });
});
