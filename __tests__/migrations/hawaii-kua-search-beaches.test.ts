import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Hawaii kua-search beach migration", () => {
  const sql = readFileSync(
    join(__dirname, "../../supabase/migrations/20260903150000_add_hawaii_kua_search_beaches.sql"),
    "utf8"
  );

  it("adds the exact source-backed search catalog without promoting it", () => {
    const candidates = [
      ["945bb965-e088-50e9-b72f-f64c029734ea", "Maniniʻōwali Beach (Kua Bay)", 19.8076655, -156.0103709],
      ["a8c5307b-65d6-57c9-899b-a9b2a7eb81d7", "Makalawena Beach", 19.7915293, -156.0282826],
      ["51f201a3-4975-5842-8025-492d1a0a559c", "Mahaiʻula Bay (Mahaiula)", 19.782004, -156.037381],
      ["1358dcf1-59a1-5040-a4c9-a856026a72dc", "Kualoa Regional Park Beach", 21.514211, -157.836136],
      ["c3b12b5b-cba6-5ad7-be34-dc3fb410076f", "Kaʻaʻawa Beach Park (Kaaawa)", 21.5498167, -157.84655],
      ["a4b380d0-da3a-55b1-a873-b03effdcbe5c", "Kahana Bay Beach", 21.555917, -157.872694],
      ["755b71d6-74d5-50f8-b44b-08154ce50401", "Mākua Beach (Makua, Oʻahu)", 21.5299767, -158.2293892],
      ["323e6269-4e83-571b-8d2e-111851d53949", "Keawaʻula Beach (Keawaula / Yokohama Bay)", 21.552819, -158.246375],
      ["33905812-2c50-5c48-af2b-d71623a93bfc", "Hāʻena Beach Park (Haena / Maniniholo)", 22.220583, -159.566833],
      ["e73e1aa8-7d90-5a3c-956f-5d64fc90cac1", "Kēʻē Beach (Kee)", 22.22149, -159.58294],
    ] as const;

    expect(new Set(candidates.map(([id]) => id)).size).toBe(10);
    for (const [id, name, lat, lon] of candidates) {
      expect(sql).toContain(`('${id}', '${name}'`);
      expect(sql).toContain(`${lat}, ${lon}`);
    }
    expect(sql.match(/"retrievedAt":"2026-09-03","fields":\[/g)).toHaveLength(21);
    expect(sql).toContain("https://dlnr.hawaii.gov/dsp/parks/hawaii/kekaha-kai-kona-coast-state-park/");
    expect(sql).toContain("https://health.hawaii.gov/cwb/files/2013/06/SampleSite_Oahu208.pdf");
    expect(sql).toContain("https://health.hawaii.gov/cwb/files/2013/06/SampleSite_Oahu230.pdf");
    expect(sql).toContain("https://dlnr.hawaii.gov/dsp/parks/kauai/haena-state-park/");
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("UUID conflicts with another catalog row");
    expect(sql).toContain("'2026-09-03T00:00:00Z'::timestamptz, false, false, false");
    expect(sql).toContain("forecast_source_id = 'open_meteo'");
    expect(sql).toContain("promoted_count <> 0");
    expect(sql).not.toContain("Mākua Beach (Tunnels, Kauaʻi)");
    expect(sql).not.toContain("terrain_enabled = true");
    expect(sql).toContain("INSERT INTO public.beach_photos");
    expect(sql.match(/::uuid, 'File:/g)).toHaveLength(9);
    expect(sql).toContain("photo_count <> 9");
    expect(sql).toContain("CC BY-SA 4.0");
    expect(sql).toContain("CC BY 2.0");
    expect(sql).not.toContain("'755b71d6-74d5-50f8-b44b-08154ce50401'::uuid, 'File:");
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql).toMatch(/^COMMIT;$/m);
  });
});
