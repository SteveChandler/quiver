import { parseUserAgent } from "@/lib/utils/user-agent-parser";

describe("parseUserAgent", () => {
  describe("device_type", () => {
    it("detects desktop for Chrome on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).device_type).toBe("desktop");
    });

    it("detects mobile for Safari on iPhone", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).device_type).toBe("mobile");
    });

    it("detects mobile for Chrome on Android", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).device_type).toBe("mobile");
    });

    it("detects tablet for Safari on iPad", () => {
      const ua =
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).device_type).toBe("tablet");
    });

    it("detects desktop for Firefox on macOS", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:120.0) Gecko/20100101 Firefox/120.0";
      expect(parseUserAgent(ua).device_type).toBe("desktop");
    });

    it("detects desktop for Edge on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
      expect(parseUserAgent(ua).device_type).toBe("desktop");
    });

    it("detects mobile for Samsung Internet on Android", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).device_type).toBe("mobile");
    });

    it("detects desktop for unknown/empty UA", () => {
      expect(parseUserAgent("").device_type).toBe("desktop");
      expect(parseUserAgent("SomeUnknownAgent/1.0").device_type).toBe("desktop");
    });
  });

  describe("os", () => {
    it("detects Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).os).toBe("Windows");
    });

    it("detects iOS for iPhone", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).os).toBe("iOS");
    });

    it("detects iOS for iPad", () => {
      const ua =
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).os).toBe("iOS");
    });

    it("detects Android", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).os).toBe("Android");
    });

    it("detects macOS", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
      expect(parseUserAgent(ua).os).toBe("macOS");
    });

    it("detects Linux", () => {
      const ua =
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).os).toBe("Linux");
    });

    it("returns unknown for unrecognized UA", () => {
      expect(parseUserAgent("").os).toBe("unknown");
    });
  });

  describe("browser", () => {
    it("detects Chrome on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).browser).toBe("Chrome");
    });

    it("detects Safari on iPhone (not Chrome)", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).browser).toBe("Safari");
    });

    it("detects Chrome on Android (not Safari)", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).browser).toBe("Chrome");
    });

    it("detects Firefox on macOS", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:120.0) Gecko/20100101 Firefox/120.0";
      expect(parseUserAgent(ua).browser).toBe("Firefox");
    });

    it("detects Edge on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
      expect(parseUserAgent(ua).browser).toBe("Edge");
    });

    it("detects Samsung Internet on Android", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).browser).toBe("Samsung Internet");
    });

    it("returns unknown for unrecognized UA", () => {
      expect(parseUserAgent("").browser).toBe("unknown");
      expect(parseUserAgent("SomeBot/1.0").browser).toBe("unknown");
    });
  });
});
