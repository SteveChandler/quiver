#!/usr/bin/env npx tsx
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { IOOSService } from '../lib/services/ioos-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  console.log('📊 Running observation sync with timestamp-based queries...\n');
  const startTime = Date.now();

  const ioosService = new IOOSService();

  // Get active stations
  const { data: stations } = await supabase
    .from("ioos_stations")
    .select("station_id, source_network")
    .eq("active", true)
    .eq("has_wave_data", true);

  if (!stations?.length) {
    console.log("No active stations");
    return;
  }

  console.log(`Processing ${stations.length} active stations...\n`);

  let synced = 0;
  let noRecentData = 0;
  let failed = 0;
  const batchSize = 10;

  for (let i = 0; i < stations.length; i += batchSize) {
    const batch = stations.slice(i, i + batchSize);
    const stationIds = batch.map(s => s.station_id);

    process.stdout.write(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stations.length / batchSize)}... `);

    const observations = await ioosService.fetchBatch(stationIds, batchSize);

    const toInsert: any[] = [];
    for (const [stationId, obs] of observations.entries()) {
      if (obs.wave_height_m !== null) {
        toInsert.push({
          station_id: stationId,
          observed_at: obs.observed_at,
          wave_height_m: obs.wave_height_m,
          wave_period_s: obs.wave_period_s,
          wave_direction_deg: obs.wave_direction_deg,
          water_temp_c: obs.water_temp_c,
        });
        synced++;
      }
    }

    noRecentData += stationIds.length - observations.size;

    if (toInsert.length > 0) {
      await supabase.from("ioos_observations").upsert(toInsert, {
        onConflict: "station_id,observed_at",
        ignoreDuplicates: true,
      });
    }

    // Update last_seen for successful stations
    const successIds = Array.from(observations.keys());
    if (successIds.length > 0) {
      await supabase
        .from("ioos_stations")
        .update({ last_seen_at: new Date().toISOString() })
        .in("station_id", successIds);
    }

    console.log(`${observations.size} fetched, ${toInsert.length} saved`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Mark stations without wave data
  const noWaveStations = ioosService.getStationsWithoutWaveData();
  if (noWaveStations.length > 0) {
    console.log(`\n📝 Marking ${noWaveStations.length} stations as has_wave_data=false`);
    await supabase
      .from("ioos_stations")
      .update({ has_wave_data: false })
      .in("station_id", noWaveStations);
  }

  // Mark stations with no recent data as inactive
  if (noRecentData > 20) {
    console.log(`\n⚠️  ${noRecentData} stations had no recent data (may be inactive)`);
  }

  // Final counts
  const { count: obsCount } = await supabase
    .from('ioos_observations')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📈 Results:`);
  console.log(`   Stations with recent data: ${synced}`);
  console.log(`   Stations with no recent data: ${noRecentData}`);
  console.log(`   Stations with wrong variables: ${noWaveStations.length}`);
  console.log(`   Total observations in DB: ${obsCount}`);
  console.log(`   Duration: ${Date.now() - startTime}ms`);
}

main();
