const mockJwtVerify = jest.fn();

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "apple-jwks"),
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
}));

import { verifyAppleIdentityToken } from "@/lib/auth/apple-identity-token";

describe("verifyAppleIdentityToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPLE_RECOVERY_AUDIENCES =
      "app.quiversurf.mobile,com.quiversurf.web";
  });

  afterEach(() => {
    delete process.env.APPLE_RECOVERY_AUDIENCES;
  });

  it("returns only the stable Apple subject and ignores relay/email ownership signals", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "000123.stable-apple-sub",
        iat: 1_785_000_000,
        email: "hidden@privaterelay.appleid.com",
        email_verified: true,
      },
    });

    const result = await verifyAppleIdentityToken(
      "signed-apple-token",
      new Date(1_785_000_120_000),
    );

    expect(result).toEqual({
      appleSub: "000123.stable-apple-sub",
      issuedAt: new Date(1_785_000_000_000),
    });
    expect(mockJwtVerify).toHaveBeenCalledWith(
      "signed-apple-token",
      "apple-jwks",
      expect.objectContaining({
        issuer: "https://appleid.apple.com",
        audience: ["app.quiversurf.mobile", "com.quiversurf.web"],
      }),
    );
  });

  it("rejects a token older than the fresh Apple challenge window", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: "stable-sub", iat: 1_785_000_000 },
    });

    await expect(
      verifyAppleIdentityToken(
        "stale-token",
        new Date(1_785_000_301_000),
      ),
    ).rejects.toThrow("Apple challenge is no longer fresh");
  });

  it("fails closed when the audience configuration is absent", async () => {
    delete process.env.APPLE_RECOVERY_AUDIENCES;
    delete process.env.APPLE_APP_BUNDLE_ID;
    delete process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;

    await expect(
      verifyAppleIdentityToken("token", new Date()),
    ).rejects.toThrow("Apple recovery audience is not configured");
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });
});
