import { WAVE_HEIGHT_SOURCE_TAGS } from "@/lib/utils/wave-height-source";

export function expectSqlDisplayWaveSourceAllowlists(sql: string): void {
  const allowlistBlocks = [
    ...sql.matchAll(
      /(?:\b[a-z]\.)?display_wave_source\s+(?:NOT\s+)?IN\s*\(([\s\S]*?)\)/g
    ),
  ];

  expect(allowlistBlocks.length).toBeGreaterThan(0);

  for (const [, block] of allowlistBlocks) {
    const sourceTags = [...block.matchAll(/'([^']+)'/g)]
      .map((match) => match[1])
      .sort();

    expect(sourceTags).toEqual([...WAVE_HEIGHT_SOURCE_TAGS].sort());
  }
}

export function expectSqlAllowedWaveSourceCtes(sql: string): void {
  const allowlistBlocks = [
    ...sql.matchAll(
      /allowed_wave_sources\s*\(\s*source_tag\s*\)\s+AS\s*\(\s*VALUES([\s\S]*?)\),\s*[a-z_][a-z0-9_]*\s+AS\s*\(/g
    ),
  ];

  expect(allowlistBlocks.length).toBeGreaterThan(0);

  for (const [, block] of allowlistBlocks) {
    const sourceTags = [...block.matchAll(/'([^']+)'/g)]
      .map((match) => match[1])
      .sort();

    expect(sourceTags).toEqual([...WAVE_HEIGHT_SOURCE_TAGS].sort());
  }
}
