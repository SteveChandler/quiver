function parseKey(raw: string | undefined): Buffer | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const key = Buffer.from(raw.trim(), "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function loadTesterIdentityKey(keyVersion: number): Buffer {
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new Error("Invalid tester identity key version");
  }

  const key = parseKey(
    process.env[`ANDROID_TESTER_ROSTER_IDENTITY_KEY_V${keyVersion}`],
  );
  if (!key) {
    throw new Error("Tester identity encryption key is unavailable");
  }
  return key;
}

export function loadActiveTesterIdentityKey(): {
  key: Buffer;
  keyVersion: number;
} {
  const rawVersion =
    process.env.ANDROID_TESTER_ROSTER_IDENTITY_ACTIVE_KEY_VERSION;
  const keyVersion = Number.parseInt(rawVersion ?? "", 10);
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new Error("Tester identity active key version is unavailable");
  }
  return { key: loadTesterIdentityKey(keyVersion), keyVersion };
}
