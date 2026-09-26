import { readFileSync } from "node:fs";
import { join } from "node:path";

function migration(name: string): string {
  return readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");
}

const verifications = migration("20260925101700_create_swell_event_verifications.sql");
const prompts = migration("20260925101800_create_session_prompt_responses.sql");

describe("swell_event_verifications migration", () => {
  it("runs in one transaction", () => {
    expect(verifications).toMatch(/^BEGIN;$/m);
    expect(verifications.trimEnd()).toMatch(/COMMIT;$/);
  });

  it("keys one forecast per event, beach and source with the contract statuses", () => {
    expect(verifications).toMatch(/CREATE TABLE IF NOT EXISTS public\.swell_event_verifications/);
    expect(verifications).toMatch(/beach_id uuid NOT NULL REFERENCES public\.beaches\(id\) ON DELETE CASCADE/);
    expect(verifications).toMatch(/source text NOT NULL CHECK \(source IN \('alert', 'snapshot'\)\)/);
    expect(verifications).toMatch(
      /status IN \('pending', 'hit', 'miss_no_show', 'miss_timing', 'miss_size', 'no_observations'\)/,
    );
    expect(verifications).toMatch(/status text NOT NULL DEFAULT 'pending'/);
    expect(verifications).toMatch(/UNIQUE \(event_key, beach_id, source\)/);
    expect(verifications).toMatch(/ON public\.swell_event_verifications \(status, forecast_peak_at\)/);
  });

  it("is service-role only: RLS on, no policies, no client grants", () => {
    expect(verifications).toMatch(/ALTER TABLE public\.swell_event_verifications ENABLE ROW LEVEL SECURITY/);
    expect(verifications).not.toMatch(/CREATE POLICY/);
    expect(verifications).toMatch(/REVOKE ALL ON public\.swell_event_verifications FROM PUBLIC, anon, authenticated/);
  });
});

describe("session_prompt_responses migration", () => {
  it("runs in one transaction", () => {
    expect(prompts).toMatch(/^BEGIN;$/m);
    expect(prompts.trimEnd()).toMatch(/COMMIT;$/);
  });

  it("uses a client-generated id and defaults the owner to the caller", () => {
    expect(prompts).toMatch(/id uuid PRIMARY KEY,/);
    expect(prompts).toMatch(
      /user_id uuid NOT NULL DEFAULT auth\.uid\(\) REFERENCES public\.profiles\(id\) ON DELETE CASCADE/,
    );
    expect(prompts).toMatch(/source text NOT NULL CHECK \(source IN \('beach_visit', 'swell_event'\)\)/);
    expect(prompts).toMatch(/response text NOT NULL CHECK \(response IN \('logged', 'not_surfed', 'dismissed'\)\)/);
    expect(prompts).toMatch(/beach_id uuid NULL REFERENCES public\.beaches\(id\) ON DELETE SET NULL/);
    expect(prompts).toMatch(/session_id uuid NULL,/);
    expect(prompts).toMatch(/ON public\.session_prompt_responses \(user_id, created_at DESC\)/);
  });

  it("lets a user select, insert and update only their own rows, and never delete", () => {
    expect(prompts).toMatch(/ALTER TABLE public\.session_prompt_responses ENABLE ROW LEVEL SECURITY/);
    expect(prompts).toMatch(/FOR SELECT TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
    expect(prompts).toMatch(/FOR INSERT TO authenticated\s+WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\)/);
    expect(prompts).toMatch(
      /FOR UPDATE TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\)\s+WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\)/,
    );
    expect(prompts).not.toMatch(/FOR DELETE/);
    expect(prompts).toMatch(/GRANT SELECT, INSERT, UPDATE ON public\.session_prompt_responses TO authenticated/);
  });
});
