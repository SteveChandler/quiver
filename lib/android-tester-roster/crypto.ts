import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const AAD = Buffer.from("quiver:android-tester-roster:v1", "utf8");

export interface TesterIdentity {
  email: string;
  externalMemberId: string;
}

export interface TesterIdentityEnvelope {
  keyVersion: number;
  iv: string;
  ciphertext: string;
  authTag: string;
}

function assertKey(key: Buffer): void {
  if (key.length !== 32) {
    throw new Error("Tester identity key must be exactly 32 bytes");
  }
}

export function encryptTesterIdentity(
  identity: TesterIdentity,
  key: Buffer,
  keyVersion: number,
): TesterIdentityEnvelope {
  assertKey(key);
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new Error("Tester identity key version must be a positive integer");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(identity), "utf8"),
    cipher.final(),
  ]);

  return {
    keyVersion,
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptTesterIdentity(
  envelope: TesterIdentityEnvelope,
  key: Buffer,
): TesterIdentity {
  assertKey(key);

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(envelope.iv, "base64url"),
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as Partial<TesterIdentity>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.externalMemberId !== "string"
    ) {
      throw new Error("Invalid tester identity payload");
    }
    return {
      email: parsed.email,
      externalMemberId: parsed.externalMemberId,
    };
  } catch {
    throw new Error("Failed to decrypt tester identity");
  }
}
