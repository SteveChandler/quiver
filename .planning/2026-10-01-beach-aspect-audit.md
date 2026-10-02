# Beach `aspect_deg` audit against CDIP MOP shore normals (2026-10-01)

`aspect_deg` is the direction a beach faces out to sea: wind from that direction counts as onshore. CDIP MOP's `metaShoreNormal` uses the same convention. Mapping California beaches to MOP points (`.planning/2026-10-02-mop-beach-mapping.sql`) found **79 of 176 mapped beaches** where the two disagree by more than 20°.

## Result

| Tier | Beaches | Action |
|---|---|---|
| 1. aspect_deg wrong (confident) | 27 | `UPDATE`s in `.planning/2026-10-01-beach-aspect-corrections.sql` |
| 2. aspect_deg very likely wrong, MOP unstable or match unclean | 24 | Suggested value below — my read; verify on a map before applying |
| 3. MOP point wrong or ambiguous | 15 | No change |
| 4. Point or reef break, both plausible | 13 | No change |

## Method

For each disagreeing beach:
- its matched MOP point's shore normal;
- the normals of the 3 points on either side (how stable the coastline is there);
- the bearing of the 10 m contour through those points;
- the beach's own `wind_offshore_deg + 180`;
- `swell_window_center_deg_v2` (geometric ray-casting; reported, not used in the rule).

The v1 swell-window center is not orientation evidence: values like 53° at Osprey Point and 108° at Luscombs aren't facings.

**Tier 1 rule (all four):**
1. Neighbour normals within 20°, and the contour bearing within 25° of the matched normal.
2. The beach within 100 m of the point's transect and 1,200 m of the point.
3. `wind_offshore_deg + 180` within 35° of the MOP normal (those values sit in 45° bins).
4. My geographic read could veto a row but never add one. It vetoed none.

The proposed value is the matched point's normal, rounded: the same source and point as `beaches.mop_shore_normal_deg`.

**Why so many are off:** 82 of the 133 California beaches with a value sit at exactly 250, 260 or 270°. They look like round defaults from catalog imports, not measured facings. Most corrections move west-facing defaults to the real SW-facing coast (North County San Diego, Orange County, Santa Monica Bay) or to the south-facing Santa Barbara–Ventura coast.

## Validation (2026-10-01)

Two independent checks of the 27 tier-1 rows, with the decision rule fixed before looking. The map is primary; Surfline only corroborates. A row drops only if the map favours the stored direction, or if both the map and Surfline contradict the proposed one.

**Map.** Esri World Imagery at zoom 16 (about 1.5 km across), with the beach pin, the stored direction (red), the proposed direction (green), the matched MOP point and its ±3 neighbours (the 10 m contour).
- **Tier 1:** in all 27 the green arrow is perpendicular to the waterline and points out to sea. Red runs along the shore or angles up the beach.
- **Closest calls:** La Jolla Shores (waterline faces about 285–290°; proposed 298°, stored 270°) and Manhattan (about 245°; proposed 246°, stored 270°). Both still favour the proposed value.
- **Tier 2:** 23 of 24 suggested values also match the waterline. Cayucos couldn't be judged, because its pin falls outside the panel.

**Surfline.** For each spot guide: confirm the spot (same break, pin within about 1.5 km), then take the "Ideal Surf Conditions → Wind" compass points. Their circular mean + 180° is the implied facing. Only the compass list was recorded.
- 11 agree with the proposed value, 8 lean to the stored value, and 8 have no data or no matching spot.
- **The disagreements don't hold up as orientation evidence.** Surfline gives a bare "E" for Seaside Reef, Pipes, Venice and Emma Wood, whose coasts face 245°, 248°, 224° and 205° on the map. In Santa Monica Bay and Ventura its ideal winds read as the regional easterly offshore pattern, not each spot's facing.

**Status:** tier 1 was applied to prod by Steven on 2026-10-01; a read-only check shows 27/27 new values live. The 23 map-validated tier-2 values are in `.planning/2026-10-01-beach-aspect-corrections-tier2.sql` (sha256 784ef8244401b207211622882887dd7979941ac27d360021f1d8f3233eee8158), applied by Steven on 2026-10-01; read-only check 23/23 live. Cayucos is excluded.

**Result:** no row drops. The SQL file is unchanged (sha256 b7364ed57d83bf342b650ba705f0ebeed84997824334030941812f92b9ee79d2), so the approval stands.

| Beach | aspect_deg → new | Map | Surfline spot | Surfline ideal wind → implied facing | Verdict |
|---|---|---|---|---|---|
| Tijuana Sloughs | 310 → 257 | Green perpendicular to the waterline, red is not | Tijuana Slough | no ideal-wind data | Keep |
| Silver Strand State Beach | 190 → 248 | Green perpendicular to the waterline, red is not | — | no matching spot | Keep |
| Coronado North Jetty | 320 → 222 | Green perpendicular to the waterline, red is not | Coronado Beach | NE → ~225° (closer to proposed) | Keep |
| La Jolla Shores | 270 → 298 | Green perpendicular to the waterline, red is not | La Jolla Shores | E, SE → ~292° (closer to proposed) | Keep |
| Seaside Reef | 270 → 243 | Green perpendicular to the waterline, red is not | Seaside Reef | E → ~270° (closer to stored) | Keep |
| San Elijo State Beach | 270 → 247 | Green perpendicular to the waterline, red is not | San Elijo State Beach | E, NE → ~248° (closer to proposed) | Keep |
| Pipes | 270 → 248 | Green perpendicular to the waterline, red is not | Pipes | E → ~270° (closer to stored) | Keep |
| Terramar Point | 270 → 233 | Green perpendicular to the waterline, red is not | Terramar Point | E, NE → ~248° (closer to proposed) | Keep |
| Tamarack | 270 → 236 | Green perpendicular to the waterline, red is not | Tamarack | E, NE → ~248° (closer to proposed) | Keep |
| Carlsbad State Beach | 270 → 236 | Green perpendicular to the waterline, red is not | Carlsbad State Beach | E, NE → ~248° (closer to proposed) | Keep |
| Forster St. Oceanside | 270 → 234 | Green perpendicular to the waterline, red is not | Forster St. Oceanside | no ideal-wind data | Keep |
| Oceanside Pier | 270 → 231 | Green perpendicular to the waterline, red is not | Oceanside Pier Northside | E, NE → ~248° (closer to proposed) | Keep |
| The Rock, Oceanside | 270 → 235 | Green perpendicular to the waterline, red is not | The Rock, Oceanside (1.9 km away — not compared) | no ideal-wind data | Keep |
| 204s | 270 → 220 | Green perpendicular to the waterline, red is not | 204s (2.2 km away — not compared) | no ideal-wind data | Keep |
| 54th Street | 260 → 236 | Green perpendicular to the waterline, red is not | — | no matching spot | Keep |
| Palos Verdes Cove | 240 → 327 | Green perpendicular to the waterline, red is not | PV Cove | E, SW → ~338° (closer to proposed) | Keep |
| Torrance Beach (RAT Beach) | 250 → 280 | Green perpendicular to the waterline, red is not | Torrance Beach | SE, E → ~292° (closer to proposed) | Keep |
| Manhattan Beach Pier | 270 → 246 | Green perpendicular to the waterline, red is not | Manhattan Beach Pier | E, SE → ~292° (closer to stored) | Keep |
| Venice Beach | 260 → 224 | Green perpendicular to the waterline, red is not | Venice Beach | E → ~270° (closer to stored) | Keep |
| Santa Monica Beach | 250 → 212 | Green perpendicular to the waterline, red is not | Santa Monica Pier | NE, E → ~248° (closer to stored) | Keep |
| Bay Street | 260 → 233 | Green perpendicular to the waterline, red is not | Bay St. | NE, E, ESE → ~263° (closer to stored) | Keep |
| Zuma Beach | 260 → 221 | Green perpendicular to the waterline, red is not | Zuma Beach | NE, E → ~248° (closer to stored) | Keep |
| Will Rogers State Beach | 250 → 207 | Green perpendicular to the waterline, red is not | Will Rogers State Beach | no ideal-wind data | Keep |
| Topanga | 260 → 176 | Green perpendicular to the waterline, red is not | Topanga Beach | N, NE → ~202° (closer to proposed) | Keep |
| Emma Wood | 250 → 205 | Green perpendicular to the waterline, red is not | Emma Wood | E → ~270° (closer to stored) | Keep |
| Solimar Reef | 260 → 222 | Green perpendicular to the waterline, red is not | Solimar | NE → ~225° (closer to proposed) | Keep |
| Mesa Lane | 275 → 210 | Green perpendicular to the waterline, red is not | Mesa Lane | no ideal-wind data | Keep |

## Tier 1 — confident (in the SQL)

| Beach | Break | aspect_deg → new | MOP point | Neighbour spread | Contour | Wind-offshore implies | v2 |
|---|---|---|---|---|---|---|---|
| Tijuana Sloughs | beach | 310 → **257** (53°) | D0020 | 7° | 238 | 225 | 270 |
| Silver Strand State Beach | beach | 190 → **248** (58°) | D0127 | 6° | 242 | 225 | 240 |
| Coronado North Jetty | jetty | 320 → **222** (98°) | D0174 | 4° | 211 | 225 | 230 |
| La Jolla Shores | beach | 270 → **298** (28°) | D0502 | 8° | 283 | 315 | 310 |
| Seaside Reef | reef | 270 → **243** (27°) | D0664 | 15° | 259 | 225 | 255 |
| San Elijo State Beach | beach | 270 → **247** (23°) | D0693 | 5° | 247 | 225 | 250 |
| Pipes | reef | 270 → **248** (22°) | D0695 | 2° | 247 | 225 | 255 |
| Terramar Point | point | 270 → **233** (37°) | D0819 | 6° | 234 | 225 | 240 |
| Tamarack | beach | 270 → **236** (34°) | D0855 | 3° | 240 | 270 | 240 |
| Carlsbad State Beach | beach | 270 → **236** (34°) | D0855 | 3° | 240 | 225 | 240 |
| Forster St. Oceanside | beach | 270 → **234** (36°) | D0894 | 2° | 232 | 225 | 240 |
| Oceanside Pier | beach | 270 → **231** (39°) | D0903 | 3° | 221 | 225 | 240 |
| The Rock, Oceanside | reef | 270 → **235** (35°) | D0909 | 3° | 225 | 225 | 240 |
| 204s | beach | 270 → **220** (50°) | OC074 | 5° | 221 | 225 | 220 |
| 54th Street | beach | 260 → **236** (24°) | OC435 | 7° | 222 | 270 | 215 |
| Palos Verdes Cove | reef | 240 → **327** (87°) | L0426 | 10° | 319 | 315 | 260 |
| Torrance Beach (RAT Beach) | beach | 250 → **280** (30°) | L0467 | 2° | 293 | 270 | 280 |
| Manhattan Beach Pier | beach | 270 → **246** (24°) | L0555 | 0° | 241 | 270 | 245 |
| Venice Beach | beach | 260 → **224** (36°) | L0692 | 8° | 234 | 225 | 220 |
| Santa Monica Beach | beach | 250 → **212** (38°) | L0716 | 15° | 222 | 225 | 220 |
| Bay Street | beach | 260 → **233** (27°) | L0720 | 15° | 226 | 225 | 220 |
| Zuma Beach | beach | 260 → **221** (39°) | L1069 | 1° | 220 | 225 | 185 |
| Will Rogers State Beach | beach | 250 → **207** (43°) | L0756 | 2° | 214 | 225 | 210 |
| Topanga | point | 260 → **176** (84°) | L0822 | 2° | 184 | 180 | 200 |
| Emma Wood | reef | 250 → **205** (45°) | VE491 | 6° | 208 | 225 | 225 |
| Solimar Reef | reef | 260 → **222** (38°) | VE536 | 5° | 214 | 225 | 220 |
| Mesa Lane | reef | 275 → **210** (65°) | B0267 | 8° | 207 | 225 | 190 |

## Tier 2 — very likely wrong; verify on a map

The current value disagrees with geography and with most of the evidence, but MOP is unstable here (a point or bend), the match is loose, or the beach's wind field disagrees. The suggested value is my read; it is not in the SQL.

| Beach | aspect_deg | Suggested | Evidence |
|---|---|---|---|
| Hotel Del Coronado | 320 | ~220 | Coronado's ocean beach faces SW; MOP 219, wind-offshore 225, v2 225 agree; only the contour bearing (184) dissents. |
| New Break (Nubes) | 245 | ~265 | West side of Point Loma faces W; MOP 271 and v2 265 agree; wind_offshore implies 225. |
| Tourmaline Beach | 270 | ~240 | North Pacific Beach faces WSW; MOP 226, contour 252, v2 240 bracket it. |
| Marine Street Beach | 240 | ~270 | La Jolla's Marine Street faces W; MOP 272, contour 290, v2 260; wind_offshore implies 225. |
| Lower Trestles | 270 | ~215 | Trestles faces SW; MOP 209, contour 225, v2 220. |
| 52nd Street | 260 | ~230 | Same stretch as 54th Street (confident 236); MOP 230, v2 215. wind_offshore_deg 90 looks wrong too. |
| County Line | 260 | ~210 | County Line faces SSW; MOP 216, v2 200, wind-offshore 180. |
| C Street / Ventura Point | 260 | ~205 | Ventura's C Street faces SSW; MOP 160 and v2 220 straddle it; 260 faces too far west. |
| Mondos Beach | 260 | ~195 | Rincon–Ventura coast faces SSW; MOP 177, contour 208, v2 190 (beach pin is 1.5 km inland). |
| El Capitan | 280 | ~185 | Gaviota coast faces S; MOP 189, contour 178, v2 190; the point makes neighbour normals swing. |
| Refugio State Beach | 280 | ~175 | Gaviota coast faces S; MOP 173, contour 173, v2 190. |
| Jalama Beach | 280 | ~235 | Jalama faces SW; MOP 244, v2 230, contour 205. |
| Pismo Pier | 270 | ~240 | Pismo faces WSW; MOP 242, v2 235 (held: pin 1.6 km inland). |
| Cayucos Pier (south side) | 285 | ~200 | Cayucos faces SSW into Estero Bay; MOP 197, contour 181, v2 220. |
| Carmel River State Beach | 205 | ~250 | Carmel River beach faces W/WSW; MOP 251, contour 248. |
| Del Monte Beach | 315 | ~345 | Monterey's Del Monte Beach faces NNW across the bay; MOP 347, contour 350, v2 345, wind-offshore 330 all agree; fails only on spread 21° and cross-track 106 m. |
| Lovers Point | 315 | ~45 | Lovers Point faces NE into Monterey Bay; MOP 50, contour 41, wind-offshore implies 0. |
| Moss Landing | 290 | ~260 | Moss Landing faces W; MOP 262, v2 260. |
| Mitchell's Cove | 285 | ~185 | Santa Cruz West Cliff faces S; MOP 173, contour 190, v2 200. wind_offshore_deg (implies 270) looks wrong too. |
| Pleasure Point | 260 | ~160 | Pleasure Point faces SSE into Monterey Bay; contour 161, MOP 136, v2 210. wind_offshore_deg (implies 270) looks wrong too. |
| 38th Avenue (Santa Cruz) | 260 | ~155 | Same coast as Pleasure Point; MOP 147, contour 163. |
| The Hook | 260 | ~155 | Same coast as Pleasure Point; MOP 140, contour 165. |
| Ocean Beach SF – North | 280 | ~265 | Ocean Beach SF faces W; MOP 251, neighbours 260, contour 268, v2 245. |
| Stinson Beach | 280 | ~210 | Stinson faces SSW toward Bolinas Bay; MOP 214, contour 193, v2 210. |

## Tier 3 — MOP point wrong or ambiguous (no change)

| Beach | aspect_deg | MOP | Why |
|---|---|---|---|
| Ocean Beach Pier | 260 | D0350 300 | MOP 300 vs contour 268 and v2 270; the pier area is between Point Loma and the San Diego River jetty. |
| Tourmaline Surf Park | 250 | D0418 215 | Contour 267 vs MOP 215; wind and v2 disagree with each other. |
| Oceanside Harbor | 270 | D0921 210 | Jetty mouth: MOP 210 vs contour 270. |
| Venice Breakwater | 270 | L0681 217 | Breakwater; neighbour normals spread 27°. |
| Morro Rock / Sandspit (inside bend) | 275 | SL352 302 | Inside the bend of Morro Rock; neighbour spread 25°. |
| Andrew Molera State Beach (river mouth) | 255 | MO421 191 | River mouth; neighbour spread 26°, contour 223 vs MOP 191. |
| Pacifica / Linda Mar | 260 | SM369 237 | Neighbour spread 67°, 130 m off-transect, pin 1.8 km inland. |
| Bodega Bay / Doran Beach | 290 | SN024 138 | Inside Bodega Harbor: MOP 138, contour 90, v2 280 — no agreement. |
| Samoa Dunes Surf Area | 270 | HU547 344 | MOP 344 is likely a point inside the Humboldt Bay entrance; contour 270. |
| Houda Point / Camel Rock | 280 | HU719 218 | MOP 218, contour 241, v2 290; pin 1.5 km inland. |
| Trinidad State Beach | 285 | HU733 195 | Neighbour spread 79° around Trinidad Head. |
| College Cove | 270 | HU744 227 | MOP 227 vs v2 275; pin 1.3 km inland. |
| Leo Carrillo State Beach | 200 | MOP 150 | Beach break, but neighbour normals spread 41° (contour 174, v2 200) — the matched point isn't representative. |
| Devereux / Sands (Coal Oil Point) | 260 | MOP 226 | Beach break, but neighbour normals spread 48° (contour 214, v2 195) — the matched point isn't representative. |
| Monastery Beach / San Jose Creek Beach | 250 | MOP 298 | Beach break, but neighbour normals spread 62° (contour 289, v2 230) — the matched point isn't representative. |

## Tier 4 — point or reef break, both plausible (no change)

At a point or reef the wave peels along a bending shoreline, so neighbour normals swing and the local normal at the matched point needn't match the facing at the take-off zone.

| Beach | aspect_deg | Evidence |
|---|---|---|
| Sunset Cliffs – Luscombs | 250 | reef break; MOP 292, neighbour spread 22°, contour 272, v2 260. |
| Osprey Point | 250 | point break; MOP 285, neighbour spread 10°, contour 267, v2 270. |
| PB Point | 270 | point break; MOP 210, neighbour spread 26°, contour 220, v2 250. |
| Swami's | 270 | point break; MOP 221, neighbour spread 15°, contour 229, v2 255. |
| Point Dume | 200 | reef break; MOP 130, neighbour spread 65°, contour 162, v2 190. |
| Latigo Point | 200 | point break; MOP 143, neighbour spread 28°, contour 150, v2 190. |
| Malibu Third Point | 200 | point break; MOP 159, neighbour spread 47°, contour 155, v2 180. |
| Malibu Surfrider (First Point) | 180 | point break; MOP 118, neighbour spread 18°, contour 160, v2 190. |
| Campus Point (UCSB) | 205 | point break; MOP 138, neighbour spread 55°, contour 157, v2 185. |
| Ghost Tree | 250 | reef break; MOP 149, neighbour spread 59°, contour 191, v2 250. |
| Steamer Lane | 290 | point break; MOP 128, neighbour spread 47°, contour 168, v2 190. |
| Mavericks | 305 | reef break; MOP 221, neighbour spread 40°, contour 241, v2 250. |
| Fort Point (San Francisco) | 295 | reef break; MOP 344, neighbour spread 49°, contour 294, v2 250. |

## Impact if applied

- **Wave-frequency wind penalty** (`lib/domains/wave-frequency/calculator.ts`) uses `cos(wind − aspect_deg)` as the onshore component, so scores move both ways. Turning a beach from 270° to about 235° makes W and NW wind count as less onshore, a smaller penalty. It also makes S and SW wind count as more onshore, a bigger penalty where there was none before.
- **Alerts** (`lib/alerts/degree-utils.ts` `resolveWindDirection`) decide "offshore" from `wind_offshore_deg`; `aspect_deg` only decides "onshore". They move less.
- **Copy:** `regional-call.ts` turns `aspect_deg` into "south-facing" style labels; `intel-generation-service.ts` and the window refiner read it too.
- **Native app:**
  - `src/lib/forecast-prefill.ts` `inferWaveType` uses the onshore component to prefill clean or choppy when a session is logged.
  - `src/lib/condition-alert-presets.ts` and `src/screens/condition-alerts.tsx` pass it to alert presets.
  - Map pins no longer use it (`beach-map-pin-coordinate.ts`).

## Dependencies and follow-ups

- **No dependency on the migration or the mapping.** `aspect_deg` already exists and the UPDATEs set it directly, so they can be applied any time. The MOP point ids come from `.planning/2026-10-02-mop-beach-mapping.sql`, which is approved but not yet applied.
- **Seven tier-1 beaches are held in that mapping file.** It comments out any match more than 45° off the old `aspect_deg`. The seven are Tijuana Sloughs (D0020), Silver Strand (D0127), Coronado North Jetty (D0174), 204s (OC074), Palos Verdes Cove (L0426), Topanga (L0822) and Mesa Lane (B0267).
  - Applying the mapping as approved leaves them without a MOP point, so `mop_shore_normal_deg` stays null.
  - This correction removes the reason they were held. Once both files are applied, uncommenting those seven held UPDATEs is a small follow-up that needs its own approval.
  - The mapping file is not regenerated, so its approved hash stands.
- **Follow-up: `wind_offshore_deg` is also stale on several beaches.** Examples: 52nd/54th Street (implies 270 on a SW coast), Mitchell's Cove, Pleasure Point. Worth the same audit, because alerts read it first.
- **Follow-up: 48 California beaches have a null `aspect_deg`** (most of Orange County). The mapped MOP normal could fill them with the same tier-1 rule.
- Prod was read-only throughout; nothing is applied or committed.

## Null aspect_deg fill (2026-10-01)

**Status:** applied to prod on 2026-10-01 under APPROVE d314476…; a read-only check shows 46/46 values live, and only Doheny Beach and Malibu First Point (Surfrider) remain null in California.

All 48 California beaches with a null `aspect_deg` were rendered on satellite imagery centred on the pin, with a compass rose and CDIP's normal. **46 get a value** (A 36, B 9, twin 1) in `.planning/2026-10-01-beach-aspect-fill-nulls.sql`; 2 stay null.

`wind_offshore_deg` was not evidence here: every Orange County row holds the same 45° default.

| Beach | Value | Basis |
|---|---|---|
| San Onofre State Beach | 216 | A: CDIP D1177 normal, neighbours ±5°, contour 218, confirmed on satellite |
| Trails | 232 | A: CDIP D1182 normal, neighbours ±7°, contour 223, confirmed on satellite |
| Old Man's (SanO) | 202 | A: CDIP D1189 normal, neighbours ±12°, contour 226, confirmed on satellite |
| Church | 190 | B: map read — Waterline faces S; CDIP contour disagrees with its normal (192 vs 219). |
| Middles | 198 | A: CDIP D1196 normal, neighbours ±6°, contour 214, confirmed on satellite |
| Upper Trestles | 209 | A: CDIP D1205 normal, neighbours ±7°, contour 224, confirmed on satellite |
| Cottons | 233 | A: CDIP D1210 normal, neighbours ±13°, contour 227, confirmed on satellite |
| San Clemente State Beach | 239 | A: CDIP OC020 normal, neighbours ±3°, contour 232, confirmed on satellite |
| Riviera | 234 | A: CDIP OC024 normal, neighbours ±2°, contour 213, confirmed on satellite |
| T-Street | 234 | A: CDIP OC039 normal, neighbours ±5°, contour 229, confirmed on satellite |
| San Clemente Pier, Northside | 232 | A: CDIP OC046 normal, neighbours ±8°, contour 227, confirmed on satellite |
| Poche Beach | 214 | A: CDIP OC101 normal, neighbours ±5°, contour 204, confirmed on satellite |
| Doheny State Beach | 170 | B: map read — Beach faces SSE east of Dana Point Harbor; CDIP contour unusable (90). |
| Strands | 243 | A: CDIP OC159 normal, neighbours ±20°, contour 243, confirmed on satellite |
| Salt Creek | 236 | A: CDIP OC166 normal, neighbours ±9°, contour 226, confirmed on satellite |
| Agate Street | 224 | A: CDIP OC247 normal, neighbours ±6°, contour 221, confirmed on satellite |
| Brooks Street | 226 | A: CDIP OC253 normal, neighbours ±8°, contour 228, confirmed on satellite |
| Thalia Street | 238 | A: CDIP OC256 normal, neighbours ±10°, contour 240, confirmed on satellite |
| Rockpile | 199 | A: CDIP OC274 normal, neighbours ±7°, contour 206, confirmed on satellite |
| Crystal Cove | 229 | A: CDIP OC313 normal, neighbours ±10°, contour 216, confirmed on satellite |
| Corona del Mar | 190 | B: map read — Beach east of the Newport Harbor jetty faces S; CDIP neighbours spread 26°. |
| The Wedge | 192 | A: CDIP OC377 normal, neighbours ±6°, contour 194, confirmed on satellite |
| Newport Lower Jetties | 197 | A: CDIP OC397 normal, neighbours ±5°, contour 206, confirmed on satellite |
| Newport Point | 200 | A: CDIP OC399 normal, neighbours ±7°, contour 206, confirmed on satellite |
| Newport Upper Jetties | 230 | B: map read — Waterline at the pin faces SW; CDIP neighbours spread 26°. |
| Blackies | 240 | B: map read — Waterline north of Newport Pier faces WSW; CDIP contour 214 vs normal 242. |
| Newport 56th St | 241 | A: CDIP OC433 normal, neighbours ±5°, contour 228, confirmed on satellite |
| River Jetties | 210 | A: CDIP OC459 normal, neighbours ±3°, contour 212, confirmed on satellite |
| Huntington State Beach | 208 | A: CDIP OC481 normal, neighbours ±4°, contour 211, confirmed on satellite |
| Huntington St. | 218 | A: CDIP OC508 normal, neighbours ±5°, contour 212, confirmed on satellite |
| Huntington Beach Pier Southside | 220 | A: CDIP OC514 normal, neighbours ±7°, contour 218, confirmed on satellite |
| Huntington Beach Pier | 221 | A: CDIP OC515 normal, neighbours ±8°, contour 221, confirmed on satellite |
| Huntington Beach Pier Northside | 220 | A: CDIP OC514 normal, neighbours ±7°, contour 218, confirmed on satellite |
| Goldenwest | 224 | A: CDIP OC541 normal, neighbours ±4°, contour 234, confirmed on satellite |
| HB Cliffs | 231 | A: CDIP OC570 normal, neighbours ±1°, contour 225, confirmed on satellite |
| Knob Hill (Redondo Beach) | 270 | A: CDIP L0486 normal, neighbours ±2°, contour 282, confirmed on satellite |
| Sapphire Street (Redondo Beach) | 273 | A: CDIP L0489 normal, neighbours ±2°, contour 295, confirmed on satellite |
| Hermosa Pier | 260 | twin — Duplicate of Hermosa Beach Pier (309 m away, 260°); CDIP 257 agrees. |
| El Porto (Manhattan) | 248 | A: CDIP L0578 normal, neighbours ±1°, contour 254, confirmed on satellite |
| Rincon | 226 | A: CDIP VE656 normal, neighbours ±4°, contour 216, confirmed on satellite |
| Cowell Beach | 140 | B: map read — West of the Santa Cruz Wharf the beach faces SE; no CDIP match. |
| Santa Cruz Main Beach | 160 | B: map read — East of the wharf the main beach faces SSE; no CDIP match. |
| Sharp Park Beach | 273 | A: CDIP SM404 normal, neighbours ±6°, contour 276, confirmed on satellite |
| Muir Beach | 190 | B: map read — Cove faces S; CDIP neighbours spread 27°. |
| Dillon Beach | 265 | B: map read — Waterline faces W; the CDIP point is 261 m off-transect. |
| North Salmon Creek Beach | 265 | A: CDIP SN082 normal, neighbours ±14°, contour 261, confirmed on satellite |

**Left null:**
- Doheny Beach: Pin sits in town inland of Dana Point Harbor; no waterline to read (likely a duplicate of Doheny State Beach).
- Malibu First Point (Surfrider): Twin Malibu Surfrider (First Point) has 180°, but the waterline at this pin faces ~ESE and CDIP gives 111°; point break, unresolved.

**Findings:**
- **Duplicate catalog rows:**
  - Hermosa Pier / Hermosa Beach Pier, 309 m apart.
  - Malibu First Point (Surfrider) / Malibu Surfrider (First Point), 194 m apart.
  - Doheny Beach / Doheny State Beach.
  - The three Huntington Beach Pier rows (pier, Northside, Southside), within about 200 m. They get consistent values: 221, 220 and 220.
- **Pins worth a look:**
  - Doheny Beach sits in town.
  - The Wedge sits on the Corona del Mar side of the harbour channel.
  - Rincon is about 2 km east of the point. Its 226° fits the beach at the pin, not the cove, so the pin needs moving.
- **Mapping coupling:** 8 of the filled beaches are held in the approved mapping file because their pins are more than 1.2 km from the point: San Onofre, Trails, Old Man's, Poche, HB Cliffs, Sharp Park, Doheny State Beach and Dillon. Their `mop_shore_normal_deg` stays null until that follow-up.

**Impact of filling (different from corrections):**
- **Wind penalty:** the wave-frequency wind penalty runs only when `aspect_deg` is set, so these 46 beaches have had no onshore penalty at all. Filling them adds one: scores drop on onshore-wind days. About 35 of the 46 are in Orange County.
- **Alerts:** `resolveWindDirection` can now return "onshore" at these beaches, where it used to fall back to "cross-shore".
- **Native:** `inferWaveType` switches from a guess based only on wind speed to one that uses the onshore component.
