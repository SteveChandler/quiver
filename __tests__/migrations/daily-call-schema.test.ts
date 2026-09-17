import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260918100000_daily_call_schema.sql"),
  "utf8",
);

describe("daily call schema migration", () => {
  it("adds daily_call_time with the 06:00 default and a value check", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS daily_call_time text NOT NULL DEFAULT '06:00'/);
    expect(sql).toMatch(/daily_call_time IN \('05:00','05:30','06:00','06:30','07:00','07:30','08:00','sunrise'\)/);
  });
  it("adds notif_swell_alerts default true and beaches.short_name", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS notif_swell_alerts boolean NOT NULL DEFAULT true/);
    expect(sql).toMatch(/ALTER TABLE public\.beaches ADD COLUMN IF NOT EXISTS short_name text/);
  });
  it("creates swell_event_alerts keyed on user + event", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.swell_event_alerts/);
    expect(sql).toMatch(/UNIQUE \(user_id, event_key\)/);
  });
  it("re-keys surf_alert_delivery_slots to user + date and drops beach from the RPC", () => {
    expect(sql).toMatch(/PRIMARY KEY \(recipient_user_id, alert_date\)/);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.claim_surf_alert_slot\(uuid, uuid, uuid, date, smallint\)/);
    expect(sql).toMatch(/FUNCTION public\.claim_surf_alert_slot\(\s*p_event_id uuid,\s*p_recipient_user_id uuid,\s*p_alert_date date,\s*p_priority smallint\s*\)/);
  });
  it("dedupes historical user+date slot rows before re-keying and keeps a five-arg compat overload", () => {
    expect(sql).toMatch(/DELETE FROM public\.surf_alert_delivery_slots AS s/);
    expect(sql).toMatch(/PARTITION BY recipient_user_id, alert_date/);
    expect(sql).toMatch(/FUNCTION public\.claim_surf_alert_slot\(\s*p_event_id uuid,\s*p_recipient_user_id uuid,\s*p_beach_id uuid,\s*p_alert_date date,\s*p_priority smallint\s*\)/);
  });
  it("disables similarity rules without deleting them", () => {
    expect(sql).toMatch(/UPDATE public\.alert_rules SET enabled = false WHERE preset_type = 'similarity_match'/);
    expect(sql).not.toMatch(/DELETE FROM public\.alert_rules/);
  });
});
