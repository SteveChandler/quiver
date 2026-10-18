/** @jest-environment node */
import { createHash } from "node:crypto";
import { generateSecret, hashSecret } from "@/lib/watch/device-token";

it("generates independent 32-byte base64url secrets", () => {
  const first = generateSecret();
  const second = generateSecret();
  expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(Buffer.from(first, "base64url")).toHaveLength(32);
  expect(second).not.toBe(first);
});

it("hashes the exact secret with SHA-256 hex", () => {
  const secret = "device-secret";
  expect(hashSecret(secret)).toBe(createHash("sha256").update(secret).digest("hex"));
  expect(hashSecret(secret)).toMatch(/^[0-9a-f]{64}$/);
});
