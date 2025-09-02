// Use lightweight mock for NextRequest/NextResponse to avoid constructor issues in Jest
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
import { NextRequest } from "next/server";
import { GET, HEAD } from "@/app/api/social/share/og/route";

// Mock crypto module
const mockHmac = {
  update: jest.fn().mockReturnThis(),
  digest: jest.fn(),
};

jest.mock("crypto", () => ({
  createHmac: jest.fn(() => mockHmac),
  timingSafeEqual: jest.fn(),
}));

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn(),
      })),
    })),
  })),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseClient),
}));

// Mock social share utils
jest.mock("@/lib/social-share-utils", () => ({
  renderShareImage: jest.fn(),
}));

import crypto from "crypto";
import { renderShareImage } from "@/lib/social-share-utils";

const mockRenderShareImage = renderShareImage as jest.MockedFunction<typeof renderShareImage>;
const mockTimingSafeEqual = crypto.timingSafeEqual as jest.MockedFunction<typeof crypto.timingSafeEqual>;

describe("/api/social/share/og", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default crypto mocks
    mockHmac.digest.mockReturnValue("fake-signature");
    mockTimingSafeEqual.mockReturnValue(true);
    
    // Default image generation
    mockRenderShareImage.mockResolvedValue({
      png: new Uint8Array([137, 80, 78, 71]), // PNG header
      w: 1080,
      h: 1920,
    });
  });

  describe("GET", () => {
    it("should generate share image for public session", async () => {
      const mockSession = {
        id: "session-1",
        user_id: "user-1",
        beach_name: "Test Beach",
        arrival_time: "2024-01-15T08:00:00Z",
        status: "completed",
        is_public: true,
        wave_quality: 4,
        rating: 85,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(response.headers.get("Cache-Control")).toContain("public");
      
      expect(mockRenderShareImage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Surf Session",
          beachName: "Test Beach",
          scheduledAt: "2024-01-15T08:00:00Z",
        }),
        "story"
      );
    });

    it("should generate share image for planned session", async () => {
      const mockSession = {
        id: "session-2",
        user_id: "user-1",
        beach_name: "Malibu",
        arrival_time: "2024-01-16T09:00:00Z",
        status: "planned",
        is_public: true,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=square"
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockRenderShareImage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Planned Session",
          beachName: "Malibu",
        }),
        "square"
      );
    });

    it("should allow access with valid signature for private session", async () => {
      const mockSession = {
        id: "session-3",
        user_id: "user-1",
        beach_name: "Private Beach",
        arrival_time: "2024-01-15T10:00:00Z",
        status: "completed",
        is_public: false,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      // Mock valid signature
      process.env.SOCIAL_SHARE_SECRET = "test-secret";
      mockTimingSafeEqual.mockReturnValue(true);

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story&t=valid-signature"
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should deny access to private session without signature", async () => {
      const mockSession = {
        id: "session-4",
        user_id: "user-1",
        beach_name: "Private Beach",
        is_public: false,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      mockTimingSafeEqual.mockReturnValue(false);

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it("should deny access to private session with invalid signature", async () => {
      const mockSession = {
        id: "session-5",
        user_id: "user-1",
        beach_name: "Private Beach",
        is_public: false,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      process.env.SOCIAL_SHARE_SECRET = "test-secret";
      mockTimingSafeEqual.mockReturnValue(false);

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story&t=invalid-signature"
      );

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it("should return 404 for non-existent session", async () => {
      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(404);
    });

    it("should handle database errors", async () => {
      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(404);
    });

    it("should validate query parameters", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=invalid-uuid&variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("should handle missing sessionId", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("should handle invalid variant", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=invalid"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("should default to story variant", async () => {
      const mockSession = {
        id: "session-6",
        beach_name: "Default Beach",
        is_public: true,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000"
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockRenderShareImage).toHaveBeenCalledWith(
        expect.anything(),
        "story"
      );
    });

    it("should handle image generation errors", async () => {
      const mockSession = {
        id: "session-7",
        beach_name: "Error Beach",
        is_public: true,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      mockRenderShareImage.mockRejectedValue(new Error("Image generation failed"));

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("should handle session without beach name", async () => {
      const mockSession = {
        id: "session-8",
        beach_name: null,
        is_public: true,
        status: "completed",
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockRenderShareImage).toHaveBeenCalledWith(
        expect.objectContaining({
          beachName: "",
        }),
        "story"
      );
    });

    it("should set appropriate cache headers", async () => {
      const mockSession = {
        id: "session-9",
        beach_name: "Cache Beach",
        is_public: true,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, s-maxage=86400, stale-while-revalidate=604800"
      );
    });
  });

  describe("HEAD", () => {
    it("should validate query and return 200", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      const response = await HEAD(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60");
    });

    it("should return 400 for invalid query parameters", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=invalid-uuid"
      );

      const response = await HEAD(request);

      expect(response.status).toBe(400);
    });

    it("should handle HEAD request errors", async () => {
      // Force an error by mocking URL constructor to throw
      const originalURL = global.URL;
      global.URL = jest.fn().mockImplementation(() => {
        throw new Error("URL error");
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000"
      );

      const response = await HEAD(request);

      expect(response.status).toBe(500);

      // Restore URL
      global.URL = originalURL;
    });

    it("should not fetch session data for HEAD request", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story"
      );

      await HEAD(request);

      // Supabase should not be called for HEAD requests
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe("Signature Verification", () => {
    beforeEach(() => {
      process.env.SOCIAL_SHARE_SECRET = "test-secret-key";
    });

    afterEach(() => {
      delete process.env.SOCIAL_SHARE_SECRET;
    });

    it("should verify HMAC signatures correctly", async () => {
      const mockSession = {
        id: "session-sig",
        beach_name: "Signature Beach",
        is_public: false,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      // Mock signature verification to pass
      mockTimingSafeEqual.mockReturnValue(true);

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story&t=valid-hmac"
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(crypto.createHmac).toHaveBeenCalledWith("sha256", "test-secret-key");
      expect(mockHmac.update).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000:story");
    });

    it("should try both hex and base64url signature formats", async () => {
      const mockSession = {
        id: "session-sig2",
        beach_name: "Dual Format Beach",
        is_public: false,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      // First call returns false (hex format fails), second returns true (base64url passes)
      mockTimingSafeEqual.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      // Setup different return values for different digest formats
      mockHmac.digest
        .mockReturnValueOnce("hex-signature")
        .mockReturnValueOnce("base64url-signature");

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story&t=base64url-signature"
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockHmac.digest).toHaveBeenCalledWith("hex");
      expect(mockHmac.digest).toHaveBeenCalledWith("base64url");
    });

    it("should reject when no secret is configured", async () => {
      delete process.env.SOCIAL_SHARE_SECRET;

      const mockSession = {
        id: "session-no-secret",
        beach_name: "No Secret Beach",
        is_public: false,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story&t=any-signature"
      );

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it("should handle signature verification exceptions", async () => {
      const mockSession = {
        id: "session-error",
        beach_name: "Error Beach",
        is_public: false,
      };

      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      // Mock timingSafeEqual to throw
      mockTimingSafeEqual.mockImplementation(() => {
        throw new Error("Buffer error");
      });

      const request = new NextRequest(
        "http://localhost:3000/api/social/share/og?sessionId=550e8400-e29b-41d4-a716-446655440000&variant=story&t=error-signature"
      );

      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });
});
