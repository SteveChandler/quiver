import {
  decryptTesterIdentity,
  encryptTesterIdentity,
} from "@/lib/android-tester-roster/crypto";

const KEY = Buffer.from("11".repeat(32), "hex");
const OTHER_KEY = Buffer.from("22".repeat(32), "hex");

describe("Android tester roster identity encryption", () => {
  it("round-trips an identity without putting plaintext or a hash in the envelope", () => {
    const identity = {
      email: "surfer@example.com",
      externalMemberId: "google-member-123",
    };

    const envelope = encryptTesterIdentity(identity, KEY, 7);

    expect(envelope.keyVersion).toBe(7);
    expect(envelope.iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(envelope.ciphertext).not.toContain(identity.email);
    expect(envelope.ciphertext).not.toContain(identity.externalMemberId);
    expect(JSON.stringify(envelope)).not.toContain(identity.email);
    expect(JSON.stringify(envelope)).not.toContain(identity.externalMemberId);
    expect(JSON.stringify(envelope)).not.toMatch(
      /email_hash|member_id_hash|sha-?256/i,
    );
    expect(decryptTesterIdentity(envelope, KEY)).toEqual(identity);
  });

  it("rejects a tampered ciphertext", () => {
    const envelope = encryptTesterIdentity(
      {
        email: "surfer@example.com",
        externalMemberId: "google-member-123",
      },
      KEY,
      1,
    );
    const tamperedCiphertext = Buffer.from(envelope.ciphertext, "base64url");
    tamperedCiphertext[0] ^= 0x01;

    expect(() =>
      decryptTesterIdentity(
        {
          ...envelope,
          ciphertext: tamperedCiphertext.toString("base64url"),
        },
        KEY,
      ),
    ).toThrow(/decrypt/i);
  });

  it("rejects the wrong key", () => {
    const envelope = encryptTesterIdentity(
      {
        email: "surfer@example.com",
        externalMemberId: "google-member-123",
      },
      KEY,
      1,
    );

    expect(() => decryptTesterIdentity(envelope, OTHER_KEY)).toThrow(/decrypt/i);
  });
});
