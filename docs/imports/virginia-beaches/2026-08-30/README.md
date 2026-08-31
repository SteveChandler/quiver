# Virginia surf beach import

This batch adds ten public Atlantic surf zones: Assateague Beach (Virginia), North End, Virginia Beach Pier, 1st Street Jetty, Croatan Jetty, Croatan Beach, Camp Pendleton's public surf area, Sandbridge Beach, S-Turn, and Little Island Fishing Pier. Fisherman Island and Chesapeake Bay beaches are excluded because they are not dependable publicly accessible Atlantic surf destinations.

## Production contract

- Coordinates and spot identities: Surfline public spot map and guides.
- Access, rules, and hazards: City of Virginia Beach, Virginia Beach Parks, National Park Service, and Virginia DWR.
- Tides: NOAA CO-OPS stations 8630413 (Assateague Beach, Toms Cove), 8639208 (Virginia Beach/Rudee), and 8639428 (Sandbridge), datum MLLW.
- Marine forecast: Open-Meteo in `America/New_York`; NWS AKQ gridpoints and NDBC 44014 are recorded as reference anchors.
- Hero media: approved `wikimedia` records with source IDs, license links, and attribution. Regional images are deliberately reused where no exact-break photograph exists.
- Terrain: 72-bin swell access and wind exposure arrays from `custom_spot_terrain_v1` / `dem_horizon_v1`, with 100% DEM coverage at each coordinate.

Terrain represents coordinate-derived land exposure only. It does not infer tide preference, skill suitability, shoaling, or bathymetric amplification. Editorial guidance supplies tide and skill inputs, and `deepwater_decay_factor` remains neutral at `1.0` until measured bathymetry or session evidence supports a change.

The migration is idempotent and aborts unless all ten rows have timezone, SEO eligibility, terrain, forecast source, and approved hero media. Rollback is a targeted delete of the ten fixed UUIDs after backing up dependent rows.

## Corrective migration and cameras

Production tracks `20260830120000` without the Virginia rows, so `20260830192230_reapply_virginia_surf_beaches.sql` replays the idempotent import under a fresh version. It assigns exact Surfline HLS feeds and still thumbnails to North End, Virginia Beach Pier, 1st Street Jetty, Croatan Jetty, Croatan Beach, and Camp Pendleton. Camp Pendleton shares the camera explicitly titled “Croatan to Pendleton.” Assateague Beach, S-Turn, and Little Island Fishing Pier have no exact Surfline feed. Sandbridge is intentionally unassigned because Surfline's published `ec-sandbridge` playlist currently returns `404 NoSuchKey`; attach it only after the HLS endpoint passes the same live compatibility check as the other feeds.

The Virginia jetty is stored as `1st Street Jetty (Virginia Beach)` because production already contains a distinct `1st Street Jetty` in Ocean City, New Jersey, and beach names are globally unique.

Surfline commercial embedding permission is not recorded in this repository. The direct HLS assignments match existing Quiver integrations but remain a production licensing risk until Surfline grants written authorization.

## Primary sources

- Surfline public reports for each named spot
- https://cvb.virginiabeach.gov/resort-management/beach-rules
- https://virginiabeach.gov/connect/blog/ocean-safety-beach-rules
- https://parks.virginiabeach.gov/outdoors/beach-boat-facilities/sandbridge-beach-facility
- https://www.nps.gov/asis/planyourvisit/surf-and-beach-safety.htm
- https://tidesandcurrents.noaa.gov/
- https://api.weather.gov/
- https://commons.wikimedia.org/
