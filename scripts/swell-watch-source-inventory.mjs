// Read-only, incident-scoped inventory: 2 precomputed NOAA index files, max32KiB
// total, no credentials, no paid API, no production database, no forecast runs.
import {createHash} from "node:crypto";
const reports=[];
for(const hour of [4,48]) {
 const url=`https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.20260913/12/wave/gridded/gfswave.t12z.global.0p16.f${String(hour).padStart(3,"0")}.grib2.idx`;
 const item={hour,requestedIssuance:"2026-09-13T12:00Z",observedAt:new Date().toISOString(),state:"unverified"};
 try {
  const r=await fetch(url,{method:"GET",redirect:"error",credentials:"omit",signal:AbortSignal.timeout(15_000)});
  item.httpStatus=r.status;
  if(r.status!==200||!r.body) { reports.push(item); continue; }
  const reader=r.body.getReader();const chunks=[];let size=0;
  for(;;) { const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new Error("response_limit");}chunks.push(value); }
  const raw=Buffer.concat(chunks);item.bytes=size;item.sha256=createHash("sha256").update(raw).digest("hex");
  const rows=raw.toString("utf8").trim().split(/\r?\n/).map(line=>line.split(":"));
  if(!rows.length||rows.some(row=>!/^\d+$/.test(row[0])||row[2]!=="d=2026091312"))throw new Error("unexpected_inventory");
  item.fields=rows.map(row=>({parameter:row[3],level:row[4],forecast:row[5]}));
  item.explicitPnrField=rows.some(row=>row[3]==="PNR");
  item.state=item.explicitPnrField?"partition_count_requires_semantic_review":"no_explicit_PNR_in_inventory";
 }catch(error){item.error=error instanceof Error && ["response_limit","unexpected_inventory"].includes(error.message)?error.message:"request_failed";}
 reports.push(item);
}
console.log(JSON.stringify({mode:"read_only_source_inventory_not_absence_proof",providerRequests:2,maximumResponseBytes:32768,
 productionWrites:0,qualifiesHatteras:false,reports},null,2));
