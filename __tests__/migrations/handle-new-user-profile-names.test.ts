import { readFileSync } from "fs";
import { join } from "path";

describe("handle_new_user profile name metadata migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260505110000_harden_handle_new_user_profile_names.sql"
    ),
    "utf8"
  );
  const verificationSQL = readFileSync(
    join(__dirname, "../../scripts/verify-handle-new-user-profile-names.sql"),
    "utf8"
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the trigger replacement in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("normalizes profile names from display_name, full_name, then name metadata", () => {
    expect(normalizedSQL).toContain(
      "nullif(btrim(new.raw_user_meta_data->>'display_name'), '')"
    );
    expect(normalizedSQL).toContain(
      "nullif(btrim(new.raw_user_meta_data->>'full_name'), '')"
    );
    expect(normalizedSQL).toContain(
      "nullif(btrim(new.raw_user_meta_data->>'name'), '')"
    );
  });

  it("inserts both full_name and display_name from the normalized name", () => {
    expect(normalizedSQL).toMatch(
      /insert into public\.profiles \([^)]*full_name[^)]*display_name/i
    );
    expect(normalizedSQL).toMatch(/values \([^;]*v_profile_name,\s+v_display_name/i);
  });

  it("fills only blank profile names on conflict", () => {
    expect(normalizedSQL).toMatch(
      /full_name = case when nullif\(btrim\(profiles\.full_name\), ''\) is null then excluded\.full_name else profiles\.full_name end/i
    );
    expect(normalizedSQL).toMatch(
      /display_name = case when nullif\(btrim\(profiles\.display_name\), ''\) is null then excluded\.display_name else profiles\.display_name end/i
    );
  });

  it("keeps the existing email and signup metadata self-heal behavior", () => {
    expect(normalizedSQL).toContain("email = case");
    expect(normalizedSQL).toContain("location = coalesce(profiles.location, excluded.location)");
    expect(normalizedSQL).toContain("signup_context = coalesce(profiles.signup_context, excluded.signup_context)");
    expect(normalizedSQL).toContain("signup_location = coalesce(profiles.signup_location, excluded.signup_location)");
    expect(normalizedSQL).toContain("raise warning 'failed to create profile for user %: %'");
    expect(normalizedSQL).toContain("return new");
  });

  it("guards display_name uniqueness so common OAuth names do not abort profile creation", () => {
    expect(normalizedSQL).toContain("where p.display_name = v_display_name");
    expect(normalizedSQL).toContain("v_display_name := null");
  });

  it("ships a rollback-safe SQL verification script for the expected cases", () => {
    expect(verificationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(verificationSQL).toMatch(/^\s*ROLLBACK;\s*$/m);
    expect(verificationSQL).toContain("display_name-only metadata");
    expect(verificationSQL).toContain("full_name-only metadata");
    expect(verificationSQL).toContain("name-only metadata");
    expect(verificationSQL).toContain("blank metadata should leave profile names null");
    expect(verificationSQL).toContain("conflict path did not fill blank profile names/email");
    expect(verificationSQL).toContain("conflict path overwrote existing profile names/email");
  });
});
