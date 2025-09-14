import {
  formatSessionForShare,
  renderShareImage,
  loadFonts,
  getTemplate,
  type SessionData,
  type ShareVariant,
} from "@/lib/social-share-utils";

// Mock filesystem operations
jest.mock("fs/promises", () => ({
  __esModule: true,
  readFile: jest.fn(),
}));

// Mock external libraries
jest.mock("satori", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@resvg/resvg-js", () => ({
  Resvg: jest.fn().mockImplementation((svg, options) => ({
    render: () => ({
      asPng: () => new Uint8Array([137, 80, 78, 71]), // PNG header bytes
    }),
  })),
}));

import { readFile } from "fs/promises";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const mockReadFile = readFile as unknown as jest.MockedFunction<typeof readFile>;
const mockSatori = satori as jest.MockedFunction<typeof satori>;

describe("Social Share Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("formatSessionForShare", () => {
    it("should format session with all data", () => {
      const session: SessionData = {
        title: "Epic Morning Session",
        beachName: "Malibu",
        scheduledAt: "2024-01-15T08:00:00Z",
        score: 85,
        waveHeightFtMin: 3,
        waveHeightFtMax: 5,
        periodSeconds: 12,
      };

      const result = formatSessionForShare(session);

      expect(result.headline).toBe("Epic Morning Session");
      expect(result.subline).toBe("Malibu • Jan 15, 8:00AM");
      expect(result.waveLine).toBe("Waist-chest (3–5 ft) • 12s");
      expect(result.scoreLine).toBe("Score 85/100");
    });

    it("should handle missing title", () => {
      const session: SessionData = {
        beachName: "Venice Beach",
        scheduledAt: "2024-01-15T08:00:00Z",
      };

      const result = formatSessionForShare(session);

      expect(result.headline).toBe("Surf Session");
      expect(result.subline).toBe("Venice Beach • Jan 15, 8:00AM");
    });

    it("should handle fallback date field", () => {
      const session: SessionData = {
        beachName: "Santa Monica",
        date: "2024-01-15T08:00:00Z",
      };

      const result = formatSessionForShare(session);

      expect(result.subline).toBe("Santa Monica • Jan 15, 8:00AM");
    });

    it("should handle missing date", () => {
      const session: SessionData = {
        beachName: "Manhattan Beach",
      };

      const result = formatSessionForShare(session);

      expect(result.subline).toBe("Manhattan Beach");
    });

    it("should format single wave height", () => {
      const session: SessionData = {
        beachName: "El Segundo",
        waveHeightFtMin: 4,
      };

      const result = formatSessionForShare(session);

      expect(result.waveLine).toBe("Waist-chest (4 ft)");
    });

    it("should describe different wave height ranges", () => {
      const testCases = [
        { height: 0.5, expected: "Flat" },
        { height: 1.5, expected: "Ankle-knee" },
        { height: 2.5, expected: "Knee-waist" },
        { height: 3.5, expected: "Waist-chest" },
        { height: 4.5, expected: "Chest-shoulder" },
        { height: 5.5, expected: "Shoulder-head" },
        { height: 7, expected: "Head-overhead" },
        { height: 9, expected: "Overhead-double" },
        { height: 12, expected: "Well overhead" },
      ];

      testCases.forEach(({ height, expected }) => {
        const session: SessionData = {
          beachName: "Test Beach",
          waveHeightFtMin: height,
        };

        const result = formatSessionForShare(session);
        expect(result.waveLine).toContain(expected);
      });
    });

    it("should handle missing wave data", () => {
      const session: SessionData = {
        beachName: "Redondo Beach",
      };

      const result = formatSessionForShare(session);

      expect(result.waveLine).toBe("");
    });

    it("should format wave range correctly", () => {
      const session: SessionData = {
        beachName: "Hermosa Beach",
        waveHeightFtMin: 2.3,
        waveHeightFtMax: 4.7,
      };

      const result = formatSessionForShare(session);

      expect(result.waveLine).toBe("Waist-chest (2–5 ft)"); // Rounded values
    });

    it("should handle missing score", () => {
      const session: SessionData = {
        beachName: "Dockweiler",
      };

      const result = formatSessionForShare(session);

      expect(result.scoreLine).toBe("");
    });

    it("should round score values", () => {
      const session: SessionData = {
        beachName: "LAX Beach",
        score: 73.8,
      };

      const result = formatSessionForShare(session);

      expect(result.scoreLine).toBe("Score 74/100");
    });

    it("should combine wave info with period", () => {
      const session: SessionData = {
        beachName: "Playa del Rey",
        waveHeightFtMin: 3,
        waveHeightFtMax: 4,
        periodSeconds: 8,
      };

      const result = formatSessionForShare(session);

      expect(result.waveLine).toBe("Waist-chest (3–4 ft) • 8s");
    });

    it("should handle period without wave height", () => {
      const session: SessionData = {
        beachName: "El Segundo Beach",
        periodSeconds: 10,
      };

      const result = formatSessionForShare(session);

      expect(result.waveLine).toBe("10s");
    });
  });

  describe("loadFonts", () => {
    it("should load available fonts successfully", async () => {
      const mockFontData = Buffer.from("fake font data");
      mockReadFile.mockResolvedValue(mockFontData);

      const fonts = await loadFonts();

      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts[0]).toEqual({
        name: "Roboto",
        data: mockFontData,
        weight: 400,
        style: "normal",
      });
    });

    it("should handle font loading failures gracefully", async () => {
      mockReadFile.mockRejectedValue(new Error("Font not found"));

      const fonts = await loadFonts();

      expect(fonts).toEqual([]);
    });

    it("should filter out failed font loads", async () => {
      mockReadFile
        .mockResolvedValueOnce(Buffer.from("roboto data"))
        .mockRejectedValueOnce(new Error("Font not found"))
        .mockResolvedValueOnce(Buffer.from("opensans data"));

      const fonts = await loadFonts();

      expect(fonts.length).toBe(2);
      expect(fonts[0].name).toBe("Roboto");
      expect(fonts[1].name).toBe("Open Sans");
    });
  });

  describe("getTemplate", () => {
    it("should generate template for story variant", () => {
      const session: SessionData = {
        beachName: "Test Beach",
        scheduledAt: "2024-01-15T08:00:00Z",
        score: 85,
      };

      const template = getTemplate(session, "story");

      // Template should be a React element
      expect(template).toBeDefined();
      expect(template.type).toBe("div");
      expect(template.props.style.width).toBe(1080);
      expect(template.props.style.height).toBe(1920);
    });

    it("should generate template for square variant", () => {
      const session: SessionData = {
        beachName: "Test Beach",
        scheduledAt: "2024-01-15T08:00:00Z",
      };

      const template = getTemplate(session, "square");

      expect(template).toBeDefined();
      expect(template.type).toBe("div");
      expect(template.props.style.width).toBe(1080);
      expect(template.props.style.height).toBe(1080);
    });

    it("should apply correct padding for different variants", () => {
      const session: SessionData = {
        beachName: "Test Beach",
      };

      const storyTemplate = getTemplate(session, "story");
      const squareTemplate = getTemplate(session, "square");

      expect(storyTemplate.props.style.padding).toBe(72);
      expect(squareTemplate.props.style.padding).toBe(64);
    });
  });

  describe("renderShareImage", () => {
    beforeEach(() => {
      mockSatori.mockResolvedValue("<svg>test</svg>");
    });

    it("should render story format image", async () => {
      const session: SessionData = {
        beachName: "Test Beach",
        scheduledAt: "2024-01-15T08:00:00Z",
      };

      mockReadFile.mockResolvedValue(Buffer.from("font data"));

      const result = await renderShareImage(session, "story");

      expect(result.w).toBe(1080);
      expect(result.h).toBe(1920);
      expect(result.png).toBeInstanceOf(Uint8Array);
      expect(mockSatori).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          width: 1080,
          height: 1920,
        })
      );
    });

    it("should render square format image", async () => {
      const session: SessionData = {
        beachName: "Test Beach",
      };

      mockReadFile.mockResolvedValue(Buffer.from("font data"));

      const result = await renderShareImage(session, "square");

      expect(result.w).toBe(1080);
      expect(result.h).toBe(1080);
      expect(result.png).toBeInstanceOf(Uint8Array);
      expect(mockSatori).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          width: 1080,
          height: 1080,
        })
      );
    });

    it("should handle font loading errors with fallback", async () => {
      const session: SessionData = {
        beachName: "Test Beach",
      };

      mockReadFile.mockRejectedValue(new Error("No fonts available"));
      mockSatori.mockRejectedValue(new Error("Font error"));

      const result = await renderShareImage(session, "square");

      expect(result.w).toBe(1080);
      expect(result.h).toBe(1080);
      expect(result.png).toBeInstanceOf(Uint8Array);
      expect(Resvg).toHaveBeenCalledWith(
        expect.stringContaining("Image Generation Error"),
        expect.objectContaining({
          fitTo: { mode: "width", value: 1080 },
        })
      );
    });

    it("should generate fallback error image with session info", async () => {
      const session: SessionData = {
        beachName: "Malibu Beach",
      };

      mockReadFile.mockRejectedValue(new Error("No fonts"));
      mockSatori.mockRejectedValue(new Error("Satori error"));

      await renderShareImage(session, "story");

      // Check that Resvg was called with error SVG containing beach name
      expect(Resvg).toHaveBeenCalledWith(
        expect.stringContaining("Malibu Beach"),
        expect.anything()
      );
    });

    it("should pass fonts to satori when available", async () => {
      const session: SessionData = {
        beachName: "Test Beach",
      };

      const mockFontData = Buffer.from("font data");
      mockReadFile.mockResolvedValue(mockFontData);

      await renderShareImage(session, "square");

      expect(mockSatori).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          fonts: expect.arrayContaining([
            expect.objectContaining({
              name: "Roboto",
              data: mockFontData,
            }),
          ]),
        })
      );
    });

    it("should work without fonts", async () => {
      const session: SessionData = {
        beachName: "Test Beach",
      };

      mockReadFile.mockRejectedValue(new Error("No fonts"));

      const result = await renderShareImage(session, "square");

      expect(mockSatori).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          fonts: [],
        })
      );
      expect(result.png).toBeInstanceOf(Uint8Array);
    });
  });

  describe("Share Template Content", () => {
    it("should include Quiver branding", () => {
      const session: SessionData = {
        beachName: "Brand Test Beach",
      };

      const template = getTemplate(session, "square");

      // Check that template includes branding elements
      const templateStr = JSON.stringify(template);
      expect(templateStr).toContain("Quiver");
      expect(templateStr).toContain("quiversurf.app");
    });

    it("should use brand colors", () => {
      const session: SessionData = {
        beachName: "Color Test Beach",
      };

      const template = getTemplate(session, "square");

      // Check gradient background with brand colors
      expect(template.props.style.backgroundImage).toContain("#0077B6"); // oceanBlue
      expect(template.props.style.backgroundImage).toContain("#FF7F11"); // sunsetOrange
    });

    it("should format session data properly in template", () => {
      const session: SessionData = {
        title: "Epic Session",
        beachName: "Template Beach",
        scheduledAt: "2024-01-15T08:00:00Z",
        score: 90,
        waveHeightFtMin: 4,
        waveHeightFtMax: 6,
        periodSeconds: 14,
      };

      const template = getTemplate(session, "square");
      const templateStr = JSON.stringify(template);

      expect(templateStr).toContain("Epic Session");
      expect(templateStr).toContain("Template Beach");
      expect(templateStr).toContain("Score 90/100");
    });
  });

  describe("Edge Cases", () => {
    it("should handle session with minimal data", () => {
      const session: SessionData = {
        beachName: "",
      };

      expect(() => getTemplate(session, "square")).not.toThrow();
      expect(() => formatSessionForShare(session)).not.toThrow();
    });

    it("should handle very large wave heights", () => {
      const session: SessionData = {
        beachName: "Big Wave Beach",
        waveHeightFtMin: 25,
        waveHeightFtMax: 35,
      };

      const result = formatSessionForShare(session);

      expect(result.waveLine).toContain("Well overhead");
      expect(result.waveLine).toContain("25–35 ft");
    });

    it("should handle fractional periods", () => {
      const session: SessionData = {
        beachName: "Micro Period Beach",
        periodSeconds: 7.3,
      };

      const result = formatSessionForShare(session);

      expect(result.waveLine).toBe("7s"); // Rounded
    });

    it("should handle extreme scores", () => {
      const testCases = [
        { score: 0, expected: "Score 0/100" },
        { score: 100, expected: "Score 100/100" },
        { score: -5, expected: "Score -5/100" },
        { score: 150, expected: "Score 150/100" },
      ];

      testCases.forEach(({ score, expected }) => {
        const session: SessionData = {
          beachName: "Score Test",
          score,
        };

        const result = formatSessionForShare(session);
        expect(result.scoreLine).toBe(expected);
      });
    });
  });
});