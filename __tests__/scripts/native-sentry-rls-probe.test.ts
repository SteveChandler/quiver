import { readFileSync } from "fs";
import { join } from "path";

describe("native Sentry RLS probe script", () => {
  const script = readFileSync(
    join(process.cwd(), "scripts", "verify-native-sentry-rls.mjs"),
    "utf8"
  );

  it("has an explicit production approval gate", () => {
    expect(script).toContain("CONFIRM_TARGET");
    expect(script).toContain("vawdnbbgawichorsjiwe");
    expect(script).toContain("CONFIRM_PROD_RLS_PROBE");
    expect(script).toContain("YES_I_HAVE_PRODUCTION_APPROVAL");
  });

  it("exercises the native authenticated session/photo/analytics write path", () => {
    expect(script).toContain("signInWithPassword");
    expect(script).toContain("Authorization: `Bearer ${accessToken}`");
    expect(script).toContain('from("sessions").insert');
    expect(script).toContain('from(STORAGE_BUCKET).upload(storagePath');
    expect(script).toContain("upsert: true");
    expect(script).toContain('from("session_media").insert');
    expect(script).toContain('from("sessions").update({ image_url: publicUrl })');
    expect(script).toContain('from("user_events").insert');
    expect(script).toContain('event_type: "session_photo_upload_succeeded"');
  });

  it("cleans up probe rows and storage objects by stable ids", () => {
    expect(script).toContain('from("user_events").delete().eq("session_id", sessionId)');
    expect(script).toContain('from("session_media").delete().eq("session_id", sessionId)');
    expect(script).toContain("remove([storagePath])");
    expect(script).toContain('from("sessions").delete().eq("id", sessionId)');
  });
});
