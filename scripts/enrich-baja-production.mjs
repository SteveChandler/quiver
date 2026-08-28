#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_PATH =
  "/Users/stevenchandler/Downloads/baja_surf_spots_2026_media_enriched_v1.json";
const MEDIA_REGISTRY_PATH =
  "/Users/stevenchandler/Downloads/baja_surf_media_registry_v1.json";
const MEDIA_COVERAGE_PATH =
  "/Users/stevenchandler/Downloads/baja_surf_media_coverage_report_v1.json";
const OUTPUT_ROOT = path.resolve(
  "docs/imports/baja-surf-spots/2026-08-27"
);
const RESEARCH_ROOT = path.join(OUTPUT_ROOT, "research");
const GEOCODE_PATH = path.join(RESEARCH_ROOT, "nominatim-reverse.json");
const COMMONS_PATH = path.join(RESEARCH_ROOT, "wikimedia-candidates.json");
const SURFTRIPS_PATH = path.join(RESEARCH_ROOT, "surftrips-editorial.json");
const OPEN_METEO_PATH = path.join(
  RESEARCH_ROOT,
  "open-meteo-marine-probes.json"
);
const WAVEWISE_PATH = path.join(RESEARCH_ROOT, "wavewise-editorial.json");
const SURFLINE_PATH = path.join(RESEARCH_ROOT, "surfline-indexed-evidence.json");
const SURFLINE_BROWSER_VALIDATION_PATH = path.join(
  RESEARCH_ROOT,
  "surfline-browser-coordinate-validation.json"
);
const OUTPUT_PATH = path.join(OUTPUT_ROOT, "baja-surf-spots-production-v2.json");
const SKILL_TIDE_REPORT_PATH = path.join(
  OUTPUT_ROOT,
  "skill-and-tide-research-v1.json"
);
const USER_AGENT =
  "QuiverBeachCatalogResearch/1.0 (https://quiversurf.app; catalog-research@quiversurf.app)";
const UUID_NAMESPACE = "9a876e0f-eec7-4d24-a765-7d0ed5e89816";
const SURFTRIPS_SITEMAP_URL = "https://surftrips.co/sitemap-spots.xml";
const WAVEWISE_SITEMAP_URL = "https://wavewise.io/sitemap.xml";
const SURFLINE_SPOTS_SITEMAP_URL =
  "https://www.surfline.com/sitemaps/spots.xml";
const OPEN_METEO_MARINE_URL =
  "https://marine-api.open-meteo.com/v1/marine";
const OPEN_METEO_VARIABLES = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
];
const COMMONS_TARGET_QUERIES = {
  "bcn-baja-malibu": ["Baja Malibu beach"],
  "bcn-rosarito": ["Rosarito Beach Baja California"],
  "bcn-k-38": ["K38 Baja California surf"],
  "bcn-las-gaviotas": ["Las Gaviotas Baja California beach"],
  "bcn-la-fonda": ["La Fonda Baja California beach"],
  "bcn-islas-de-todos-santos": ["Islas de Todos Santos Baja California"],
  "bcn-san-miguel": ["Playa San Miguel Ensenada Baja California"],
  "bcn-punta-san-carlos": ["Punta San Carlos Baja California surf"],
  "bcn-punta-san-jacinto-shipwrecks": ["Punta San Jacinto shipwreck Baja California"],
  "bcs-bahia-tortugas-turtle-bay": ["Bahia Tortugas Baja California Sur coast"],
  "bcs-punta-abreojos": ["Punta Abreojos Baja California Sur"],
  "bcs-scorpion-bay-san-juanico": ["San Juanico Scorpion Bay Baja California Sur"],
  "bcs-cerritos": ["Cerritos Beach Baja California Sur"],
  "bcs-cabo-pulmo": ["Cabo Pulmo beach Baja California Sur"],
  "bcs-zippers-costa-azul": ["Costa Azul San Jose del Cabo beach"],
  "bcs-monuments": ["Monuments Beach Cabo San Lucas"],
  "bcs-bahia-chileno": ["Chileno Bay beach Baja California Sur"],
  "bcs-nine-palms": ["Nine Palms East Cape Baja California Sur"],
  "bcs-shipwrecks": ["Shipwrecks East Cape Baja California Sur surf"],
};
const LOCALITY_OVERRIDES = {
  "bcn-san-antonio-del-mar-tijuana": "Tijuana",
  "bcn-rosarito": "Rosarito",
  "bcn-el-paso": "Ensenada",
  "bcn-mirador-viewpoint": "Ensenada",
  "bcn-dunes": "La Misión",
  "bcn-la-fonda": "La Misión",
  "bcn-halfway-house": "La Misión",
  "bcn-la-mision": "La Misión",
  "bcn-punta-piedra-rocky-point": "La Misión",
  "bcn-lighthouse-punta-san-jose": "Ensenada",
  "bcn-k-181": "Punta Colonet",
  "bcn-san-antonio-del-mar-colonet-area": "Punta Colonet",
  "bcn-cabo-colonet": "Punta Colonet",
  "bcn-quatro-casas": "Eréndira",
  "bcn-camalu": "Camalú",
  "bcn-casas": "El Rosario",
  "bcn-punta-baja": "El Rosario",
  "bcn-punta-san-antonio": "El Rosario",
  "bcn-punta-blanca-seven-sisters": "Santa Rosalillita",
  "bcn-punta-cono": "Santa Rosalillita",
  "bcn-punta-maria": "Santa Rosalillita",
  "bcn-punta-ositos": "Santa Rosalillita",
  "bcn-puerto-san-andres": "Santa Rosalillita",
  "bcn-punta-rosarito": "Santa Rosalillita",
  "bcn-millers-landing": "Santa Rosalillita",
  "bcn-playa-elefante-isla-cedros": "Isla Cedros",
  "bcs-punta-santo-domingo": "Mulegé",
  "bcs-la-laguna": "Mulegé",
  "bcs-punta-san-gregorio": "San Juanico",
  "bcs-san-jorge": "Las Barrancas",
  "bcs-cerritos": "El Pescadero",
  "bcs-playa-los-cerritos": "El Pescadero",
  "bcs-el-pescadero": "El Pescadero",
  "bcs-la-bocana-todos-santos-area": "Todos Santos",
  "bcs-la-pastora": "Todos Santos",
  "bcs-playa-san-pedro": "Todos Santos",
  "bcs-punta-conejo": "La Paz",
  "bcs-punta-marquez": "La Paz",
  "bcs-beachbreak": "La Paz",
  "bcs-punta-gasparino": "La Paz",
  "bcs-punta-arenas": "Cabo Pulmo",
  "bcs-cabo-pulmo": "Cabo Pulmo",
  "bcs-boca-del-salado": "Cabo Pulmo",
  "bcs-punta-palmilla": "San José del Cabo",
};
const HERO_APPROVALS = {
  "bcn-rosarito": "File:Rosarito Beach.jpg",
  "bcn-islas-de-todos-santos": "File:Isla de Todos Santos - from boat.jpg",
  "bcn-san-miguel": "File:Playa San Miguel, Ensenada Baja California.jpg",
  "bcs-cabo-pulmo": "File:Cabo Pulmo - Plage au coucher du Soleil - 1.jpg",
  "bcs-cerritos":
    "File:Panorama of Cerritos Beach - Near Todos Santos - Baja California Sur - Mexico - 01 (23775145865).jpg",
};
const GENERATED_ASSETS = {
  "baja-norte-beach-v1": {
    local_path: "/images/beaches/baja/baja-norte-beach-v1.webp",
    prompt_summary:
      "Representative northern Baja sandy beach at cool dawn with marine layer, low bluffs, sparse scrub, and modest clean surf.",
  },
  "baja-norte-reef-point-v1": {
    local_path: "/images/beaches/baja/baja-norte-reef-point-v1.webp",
    prompt_summary:
      "Representative northern Baja rocky reef and point at cool dawn with marine layer, weathered headland, and modest wrapping surf.",
  },
  "baja-sur-beach-v1": {
    local_path: "/images/beaches/baja/baja-sur-beach-v1.webp",
    prompt_summary:
      "Representative southern Baja sandy beach at golden dawn with arid hills, sparse native vegetation, and modest clean surf.",
  },
  "baja-sur-reef-point-v1": {
    local_path: "/images/beaches/baja/baja-sur-reef-point-v1.webp",
    prompt_summary:
      "Representative southern Baja rocky reef and point at golden dawn with desert headland and modest wrapping surf.",
  },
};
const WAVEWISE_SPOT_URLS = {
  "bcn-san-antonio-del-mar-tijuana":
    "https://wavewise.io/surf-spots/san-antonio-del-mar-mx-baja-norte",
  "bcn-el-morro-point-k37-5":
    "https://wavewise.io/surf-spots/el-morro-point-k371-2-mx-baja-norte",
  "bcn-k-55-1-2":
    "https://wavewise.io/surf-spots/campo-lopez-k-55-mx-baja-norte",
};
const SURFTRIPS_SPOT_URLS = {
  "bcn-baja-malibu": "https://surftrips.co/mexico/baja-california/baja-malibu",
  "bcn-marisol-north-point": "https://surftrips.co/mexico/baja-california/marisol-north-point",
  "bcn-rosarito": "https://surftrips.co/mexico/baja-california/rosarito-beach",
  "bcn-alfonsos": "https://surftrips.co/mexico/baja-california/alfonsos",
  "bcn-calafia": "https://surftrips.co/mexico/baja-california/calafia",
  "bcn-k-38": "https://surftrips.co/mexico/baja-california/k-38",
  "bcn-las-gaviotas": "https://surftrips.co/mexico/baja-california/las-gaviotas",
  "bcn-dunes": "https://surftrips.co/mexico/baja-california/dunes",
  "bcn-la-fonda": "https://surftrips.co/mexico/baja-california/la-fonda",
  "bcn-halfway-house": "https://surftrips.co/mexico/baja-california/halfway-house",
  "bcn-salsipuedes": "https://surftrips.co/mexico/baja-california/salsipuedes",
  "bcn-islas-de-todos-santos": "https://surftrips.co/mexico/baja-california/todos-santos-killers",
  "bcn-san-miguel": "https://surftrips.co/mexico/baja-california/san-miguel",
  "bcn-3ms": "https://surftrips.co/mexico/baja-california/3ms",
  "bcn-ensenada-beaches": "https://surftrips.co/mexico/baja-california/ensenada-beaches",
  "bcn-boca-de-santo-tomas": "https://surftrips.co/mexico/baja-california/boca-de-santo-tomas",
  "bcn-lighthouse-punta-san-jose": "https://surftrips.co/mexico/baja-california/lighthouse-punta-san-jose",
  "bcn-punta-cabras": "https://surftrips.co/mexico/baja-california/punta-cabras",
  "bcn-k-181": "https://surftrips.co/mexico/baja-california/k-181",
  "bcn-san-antonio-del-mar-colonet-area": "https://surftrips.co/mexico/baja-california/san-antonio-del-mar-sur",
  "bcn-cabo-colonet": "https://surftrips.co/mexico/baja-california/cabo-colonet",
  "bcn-quatro-casas": "https://surftrips.co/mexico/baja-california/quatro-casas",
  "bcn-cielito-lindo": "https://surftrips.co/mexico/baja-california/cielito-lindo",
  "bcn-casas": "https://surftrips.co/mexico/baja-california/casas",
  "bcn-punta-baja": "https://surftrips.co/mexico/baja-california/punta-baja",
  "bcn-punta-san-carlos": "https://surftrips.co/mexico/baja-california/punta-san-carlos",
  "bcn-punta-canoas": "https://surftrips.co/mexico/baja-california/punta-canoas",
  "bcn-punta-blanca-seven-sisters": "https://surftrips.co/mexico/baja-california/punta-blanca",
  "bcn-punta-maria": "https://surftrips.co/mexico/baja-california/punta-maria",
  "bcn-el-cardon": "https://surftrips.co/mexico/baja-california/el-cardon",
  "bcn-punta-negra": "https://surftrips.co/mexico/baja-california/punta-negra",
  "bcn-puerto-san-andres": "https://surftrips.co/mexico/baja-california/puerto-san-andres",
  "bcn-punta-rosarito": "https://surftrips.co/mexico/baja-california/the-wall",
  "bcn-millers-landing": "https://surftrips.co/mexico/baja-california/millers-landing",
  "bcs-campo-renes": "https://surftrips.co/mexico/baja-california-sur/campo-renes",
  "bcs-punta-abreojos": "https://surftrips.co/mexico/baja-california-sur/punta-abreojos",
  "bcs-la-bocana-mulege-municipality": "https://surftrips.co/mexico/baja-california-sur/la-bocana-cc727a",
  "bcs-punta-santo-domingo": "https://surftrips.co/mexico/baja-california-sur/punta-santo-domingo",
  "bcs-scorpion-bay-san-juanico": "https://surftrips.co/mexico/baja-california-sur/scorpion-bay",
  "bcs-punta-conejo": "https://surftrips.co/mexico/baja-california-sur/punta-conejo",
  "bcs-beachbreak": "https://surftrips.co/mexico/baja-california-sur/beachbreak",
  "bcs-punta-arenas": "https://surftrips.co/mexico/baja-california-sur/punta-arenas",
  "bcs-san-pedrito-todos-santos": "https://surftrips.co/mexico/baja-california-sur/san-pedrito",
  "bcs-el-pescadero": "https://surftrips.co/mexico/baja-california-sur/pescadero",
  "bcs-cerritos": "https://surftrips.co/mexico/baja-california-sur/cerritos",
  "bcs-nine-palms": "https://surftrips.co/mexico/baja-california-sur/nine-palms",
  "bcs-shipwrecks": "https://surftrips.co/mexico/baja-california-sur/shipwreck",
  "bcs-san-jose-rivermouth": "https://surftrips.co/mexico/baja-california-sur/the-estuary",
  "bcs-acapulquito-costa-azul": "https://surftrips.co/mexico/baja-california-sur/old-man-s",
  "bcs-the-rock-costa-azul": "https://surftrips.co/mexico/baja-california-sur/the-rock",
  "bcs-zippers-costa-azul": "https://surftrips.co/mexico/baja-california-sur/zippers",
  "bcs-costa-azul": "https://surftrips.co/mexico/baja-california-sur/costa-azul",
  "bcs-monuments": "https://surftrips.co/mexico/baja-california-sur/monuments",
  "bcs-backwash": "https://surftrips.co/mexico/baja-california-sur/backwash",
  "bcs-boca-del-salado": "https://surftrips.co/mexico/baja-california-sur/boca-del-solado",
};
const SURFLINE_SPOT_URL_OVERRIDES = {
  "bcn-san-antonio-del-mar-tijuana":
    "https://www.surfline.com/surf-report/san-antonio-del-mar--norte/584204204e65fad6a77091ae",
  "bcn-rosarito":
    "https://www.surfline.com/surf-report/rosarito-beach/5842041f4e65fad6a7708bd0",
  "bcn-el-morro-point-k37-5":
    "https://www.surfline.com/surf-report/el-morro-point-k37-5-/584204204e65fad6a77091bb",
  "bcn-k-40":
    "https://www.surfline.com/surf-report/k-40-puerto-nuevo-/584204204e65fad6a77091bc",
  "bcn-campo-lopez-k-55":
    "https://www.surfline.com/surf-report/campo-lopez-k-55-/584204204e65fad6a77091c2",
  "bcn-islas-de-todos-santos":
    "https://www.surfline.com/surf-report/todos-santos--killers/5842041f4e65fad6a7708bc7",
  "bcn-lighthouse-punta-san-jose":
    "https://www.surfline.com/surf-report/lighthouse-punta-san-jose-/584204204e65fad6a77091d3",
  "bcn-punta-san-jacinto-shipwrecks":
    "https://www.surfline.com/surf-report/punta-san-jacinto-shipwrecks-/584204204e65fad6a77091de",
  "bcn-san-antonio-del-mar-colonet-area":
    "https://www.surfline.com/surf-report/san-antonio-del-mar--sur/584204204e65fad6a77091da",
  "bcn-playa-elefante-isla-cedros":
    "https://www.surfline.com/surf-report/playa-elefante-isla-cedros-/584204204e65fad6a7709207",
  "bcs-open-doors-isla-natividad":
    "https://www.surfline.com/surf-report/open-doors/640a43e1e9203087f19eec32",
  "bcn-punta-blanca-seven-sisters":
    "https://www.surfline.com/surf-report/punta-blanca/584204204e65fad6a77091fd",
  "bcn-punta-santa-rosalillita-the-wall":
    "https://www.surfline.com/surf-report/punta-sta-rosalillita/640a43dfb6d769dfda5246ca",
  "bcn-punta-rosarito":
    "https://www.surfline.com/surf-report/punta-rosarito/584204204e65fad6a77091fe",
  "bcs-bahia-tortugas-turtle-bay":
    "https://www.surfline.com/surf-report/bahia-tortugas-turtle-bay-/584204204e65fad6a770920b",
  "bcs-scorpion-bay-san-juanico":
    "https://www.surfline.com/surf-report/scorpion-bay/640a43e6e920303e539eed3b",
  "bcs-la-bocana-mulege-municipality":
    "https://www.surfline.com/surf-report/la-bocana/584204204e65fad6a770920f",
  "bcs-la-bocana-todos-santos-area":
    "https://www.surfline.com/surf-report/la-bocana/584204204e65fad6a770922e",
  "bcs-el-pescadero":
    "https://www.surfline.com/surf-report/pescadero/640a43e3b6d7691fdc5247be",
  "bcs-cerritos":
    "https://www.surfline.com/surf-report/cerritos/5842041f4e65fad6a7708bd5",
  "bcs-playa-los-cerritos":
    "https://www.surfline.com/surf-report/cerritos/5842041f4e65fad6a7708bd5",
  "bcs-shipwrecks":
    "https://www.surfline.com/surf-report/shipwreck/5842041f4e65fad6a7708bdb",
  "bcs-san-pedrito-todos-santos":
    "https://www.surfline.com/surf-report/san-pedrito/5842041f4e65fad6a7708bd6",
  "bcs-acapulquito-costa-azul":
    "https://www.surfline.com/surf-report/old-man-s/5842041f4e65fad6a7708bd4",
  "bcs-the-rock-costa-azul":
    "https://www.surfline.com/surf-report/the-rock/5842041f4e65fad6a7708bd7",
  "bcs-zippers-costa-azul":
    "https://www.surfline.com/surf-report/zippers/5842041f4e65fad6a7708bda",
  "bcn-punta-negra":
    "https://www.surfline.com/surf-report/punta-negra/584204204e65fad6a7709213",
  "bcs-punta-colorado":
    "https://www.surfline.com/surf-report/punta-colorados/584204204e65fad6a7709255",
  "bcs-boca-del-salado":
    "https://www.surfline.com/surf-report/boca-del-solado/584204204e65fad6a770924f",
  "bcs-punta-palmilla":
    "https://www.surfline.com/surf-report/punta-pamilla/584204204e65fad6a770924c",
};
const SURFLINE_BROWSER_SPOT_EVIDENCE = {
  "bcs-boca-del-salado": {
    displayed_name: "Boca Del Solado",
    coordinate: { latitude: 23.254, longitude: -109.436 },
    breadcrumb_locality: "Las Veredas",
    evidence_method: "public_in_app_browser_rendered_spot_guide",
    checked_on: "2026-08-27",
  },
  "bcs-punta-palmilla": {
    displayed_name: "Punta Pamilla",
    coordinate: { latitude: 23.008, longitude: -109.712 },
    breadcrumb_locality: "San José del Cabo",
    evidence_method: "public_in_app_browser_rendered_spot_guide",
    checked_on: "2026-08-27",
  },
};
const SURFLINE_INDEXED_GUIDE_EVIDENCE = {
  "bcn-baja-malibu": {
    guide_url:
      "https://www.surfline.com/travel/zones/baja/surf-guide/baja-malibu/5842041f4e65fad6a7708e1b",
    minimum_skill: "intermediate",
    preferred_stage: "mid",
    swell_directions: ["NW", "WNW", "SW", "SSW"],
    offshore_winds: ["ESE", "E", "ENE", "NE"],
    hazards: ["heavy impact zone on larger days", "post-rain water quality"],
  },
  "bcn-k-38": {
    guide_url:
      "https://www.surfline.com/travel/zones/baja/surf-guide/k-38/584204204e65fad6a77091ba",
    minimum_skill: "intermediate",
    preferred_stage: "low_to_mid",
    swell_directions: ["S", "SW", "W", "WNW"],
    offshore_winds: ["NE", "E"],
    hazards: ["rocky reef", "crowds"],
  },
  "bcn-las-gaviotas": {
    guide_url:
      "https://www.surfline.com/travel/zones/baja/surf-guide/las-gaviotas/584204204e65fad6a77091b9",
    minimum_skill: "beginner",
    preferred_stage: "all",
    swell_directions: ["S", "SW", "W", "WNW"],
    offshore_winds: ["NE", "ENE", "E", "ESE", "SE"],
    hazards: ["current", "possible sewage spills"],
  },
  "bcn-la-fonda": {
    guide_url:
      "https://www.surfline.com/travel/zones/baja/surf-guide/la-fonda/584204204e65fad6a77091c7",
    minimum_skill: "intermediate",
    preferred_stage: "low_to_mid",
    swell_directions: ["SW", "W"],
    offshore_winds: ["E"],
    hazards: ["demanding paddle on larger swells", "crowds"],
  },
  "bcn-rosarito": {
    guide_url:
      "https://www.surfline.com/surf-report/rosarito-beach/5842041f4e65fad6a7708bd0/spot-guide",
    minimum_skill: "beginner",
    preferred_stage: "mid",
    swell_directions: ["NW", "SW"],
    offshore_winds: ["E"],
    hazards: ["petty theft", "pollution near river outlets"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcn-salsipuedes": {
    guide_url:
      "https://www.surfline.com/surf-report/salsipuedes/5842041f4e65fad6a7708bd2/spot-guide",
    minimum_skill: "intermediate",
    preferred_stage: "low",
    swell_directions: ["W", "NW"],
    offshore_winds: ["N"],
    hazards: ["shallow rocks", "difficult boat access"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcn-islas-de-todos-santos": {
    guide_url:
      "https://www.surfline.com/surf-report/todos-santos--killers/5842041f4e65fad6a7708bc7/spot-guide",
    minimum_skill: "advanced",
    preferred_stage: "low",
    swell_directions: ["NW", "W"],
    offshore_winds: ["E"],
    hazards: ["exposed rocks", "currents", "extremely powerful surf", "boat-only access"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcn-san-miguel": {
    guide_url:
      "https://www.surfline.com/surf-report/san-miguel/5842041f4e65fad6a7708bc9/spot-guide",
    minimum_skill: "intermediate",
    preferred_stage: "mid_to_high",
    swell_directions: ["W", "NW"],
    offshore_winds: ["NE"],
    hazards: ["rocks", "urchins"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcn-3ms": {
    guide_url:
      "https://www.surfline.com/surf-report/3ms/584204204e65fad6a77091cd/spot-guide",
    minimum_skill: "intermediate",
    preferred_stage: "all",
    swell_directions: ["SW", "W", "WNW"],
    offshore_winds: ["NE", "ENE", "E"],
    hazards: ["sharks", "rocks", "rips", "pollution"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcn-quatro-casas": {
    guide_url:
      "https://www.surfline.com/surf-report/quatro-casas/584204204e65fad6a77091d9/spot-guide",
    minimum_skill: "beginner",
    preferred_stage: "all",
    swell_directions: ["S", "SW", "W", "NW"],
    offshore_winds: ["NE"],
    hazards: ["rocks", "crowds"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcn-punta-san-carlos": {
    guide_url:
      "https://www.surfline.com/surf-report/punta-san-carlos/584204204e65fad6a77091fb/spot-guide",
    minimum_skill: "beginner",
    preferred_stage: "low_to_mid",
    swell_directions: ["SW", "SSW", "S", "W", "WNW"],
    offshore_winds: ["N", "NE"],
    hazards: ["urchins", "rocks", "rips", "remote access"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcs-beachbreak": {
    guide_url:
      "https://www.surfline.com/surf-report/beachbreak/584204204e65fad6a770922d/spot-guide",
    minimum_skill: "beginner",
    preferred_stage: "all",
    swell_directions: ["SW", "SSW", "S", "SE", "W", "WNW"],
    offshore_winds: ["NE", "E"],
    hazards: ["rips", "isolation", "vehicles can become stuck on the beach"],
  },
  "bcs-campo-renes": {
    guide_url:
      "https://www.surfline.com/surf-report/campo-renes/584204204e65fad6a7709211/spot-guide",
    minimum_skill: "intermediate",
    preferred_stage: "all",
    swell_directions: ["S", "SE", "SW", "SSW"],
    offshore_winds: ["NW", "N", "NE"],
    hazards: ["rips", "rocks", "sharks"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcs-cerritos": {
    guide_url:
      "https://www.surfline.com/surf-report/cerritos/5842041f4e65fad6a7708bd5/spot-guide",
    minimum_skill: "beginner",
    preferred_stage: "mid",
    swell_directions: ["NW", "WNW", "SW", "SSW"],
    offshore_winds: ["E"],
    hazards: ["crowded beginner lineup"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcs-nine-palms": {
    guide_url:
      "https://www.surfline.com/surf-report/nine-palms/5842041f4e65fad6a7708bdc/spot-guide",
    minimum_skill: "beginner",
    preferred_stage: "mid",
    preferred_direction: "rising",
    swell_directions: ["S", "SE"],
    offshore_winds: ["NW"],
    hazards: ["rocks"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcs-shipwrecks": {
    guide_url:
      "https://www.surfline.com/surf-report/shipwreck/5842041f4e65fad6a7708bdb/spot-guide",
    minimum_skill: "intermediate",
    preferred_stage: "mid",
    swell_directions: ["S"],
    offshore_winds: ["N"],
    hazards: ["rocks", "reef", "cliff access"],
    evidence_method: "public_in_app_browser_rendered_spot_guide",
  },
  "bcs-san-pedrito-todos-santos": {
    guide_url:
      "https://www.surfline.com/travel/zones/cabo/surf-guide/san-pedrito/5842041f4e65fad6a7708bd6",
    minimum_skill: "intermediate",
    preferred_stage: "mid",
    swell_directions: ["NW", "S"],
    offshore_winds: ["E"],
    hazards: ["competitive crowd when conditions are good"],
  },
  "bcs-acapulquito-costa-azul": {
    guide_url:
      "https://www.surfline.com/travel/zones/cabo/surf-guide/old-mans/5842041f4e65fad6a7708bd4",
    minimum_skill: "beginner",
    preferred_stage: "mid",
    swell_directions: ["SSE", "S", "SSW"],
    offshore_winds: ["N", "NW"],
    hazards: ["crowds", "shallow reef section"],
  },
  "bcs-the-rock-costa-azul": {
    guide_url:
      "https://www.surfline.com/travel/zones/cabo/surf-guide/the-rock/5842041f4e65fad6a7708bd7",
    minimum_skill: "intermediate",
    preferred_stage: "mid_to_high",
    swell_directions: ["S", "SW"],
    offshore_winds: ["W", "NW"],
    hazards: ["shallow rocks", "crowds"],
  },
  "bcs-zippers-costa-azul": {
    guide_url:
      "https://www.surfline.com/travel/zones/cabo/surf-guide/zippers/5842041f4e65fad6a7708bda",
    minimum_skill: "advanced",
    preferred_stage: "low_to_mid",
    swell_directions: ["S"],
    offshore_winds: ["N"],
    hazards: ["heavy competitive crowd", "exposed rocks"],
  },
  "bcs-monuments": {
    guide_url:
      "https://www.surfline.com/travel/zones/cabo/surf-guide/monuments/5842041f4e65fad6a7708bd8",
    minimum_skill: "intermediate",
    preferred_stage: "high",
    swell_directions: ["SSW", "SW", "W"],
    offshore_winds: ["NE"],
    hazards: ["tight takeoff", "urchins", "shallow inside rocks", "crowds"],
  },
};
const REGIONAL_RESEARCH_SOURCES = {
  baja_norte: "https://visitingmexico.com/surfing/",
  baja_sur:
    "https://www.mywavefinder.com/destination/baja-california-sur-mexico-surf-guide/",
  seven_sisters:
    "https://vivabaja.com/wp-content/uploads/2022/01/2021-Baja-Bound-Guide-Norte.pdf",
  los_cabos:
    "https://aquacoreadventures.com/blog/los-cabos-surf-spots-cerritos-zippers-monuments/",
};
const MANUAL_EDITORIAL_EVIDENCE = {
  "bcn-el-paso": {
    source_url:
      "https://www.surfline.com/surf-reports-forecasts-cams/mexico/baja-california/4017700",
    note: "Surfline's Baja regional map independently lists El Paso in the Ensenada sequence.",
  },
  "bcn-mirador-viewpoint": {
    source_url:
      "https://breakfinder.surf/en/surf_spots/mirador-viewpoint",
    coordinate: { latitude: 31.986, longitude: -116.854 },
    note: "BreakFinder publishes a matching named map pin in the Ensenada surf corridor.",
  },
  "bcn-punta-san-antonio": {
    source_url:
      "https://deepswell.com/surf-guide/Mexico/Central-Baja/Punta-San-Antonio/1493",
    swell_window: { min_deg: 225, max_deg: 270 },
    access_tip:
      "More than 10 miles of difficult dirt-road access separates the coast from Highway 1; use a capable high-clearance 4WD vehicle, carry recovery and emergency supplies, and verify current conditions locally.",
    hazards: ["rocks", "isolation"],
  },
  "bcn-k-40": {
    source_url:
      "https://deepswell.com/surf-guide/Mexico/Northern-Baja/K-40/1454",
    skill_level: "intermediate",
    tide_guidance: {
      preferred_stage: "mid_to_high",
      preferred_direction: "either",
      source_text: "DeepSwell lists K-40's best tide as mid to high.",
    },
    note:
      "DeepSwell and Yeeew independently describe K-40 as an intermediate-to-advanced reef break that works best from mid to high tide.",
  },
  "bcn-punta-cono": {
    source_url: "https://www.thebobibook.com/sevensisters",
    access_tip:
      "Punta Cono is within the remote Seven Sisters dirt-road corridor. Expect no services or reliable cell coverage; carry water, fuel, recovery gear, and offline navigation.",
    hazards: ["rocks", "rips", "isolation"],
    swell_window: { min_deg: 247.5, max_deg: 337.5 },
  },
  "bcn-punta-ositos": {
    source_url: "https://breakfinder.surf/en/surf_spots/punta-ositos",
    coordinate: { latitude: 28.872, longitude: -114.44 },
    swell_window: { min_deg: 202.5, max_deg: 315 },
    hazards: ["rips", "isolation"],
  },
  "bcn-playa-elefante-isla-cedros": {
    source_url:
      "https://digaohm.semar.gob.mx/derrotero/cuestionarios/cnarioIslacedros.pdf",
    access_tip:
      "Isla Cedros access requires confirmed air or boat logistics, local ground transport, weather checks, and landing permission. The surf pin is not a harbor or launch coordinate.",
    hazards: ["rocks", "isolation"],
  },
  "bcs-la-laguna": {
    source_url:
      "https://www.discoverbaja.com/wp-content/uploads/January-Newsletter1.pdf",
    access_tip:
      "Use current San Juanico-area local guidance for the beach or south-road route. Carry offline maps and verify arroyo, sand, and tide conditions before leaving town.",
    hazards: ["rips", "isolation"],
    skill_level: "beginner",
    skill_source_url:
      "https://breakfinder.surf/en/surf_spots/la-laguna",
    note:
      "Search-indexed BreakFinder spot guidance rates La Laguna as beginner; Quiver retains the stricter conditions-dependent level because the exposed setting, rocks, remoteness, and sharks remain material.",
  },
  "bcs-punta-san-gregorio": {
    source_url:
      "https://deepswell.com/surf-guide/Mexico/Southern-Baja/Punta-San-Gregorio/1514",
    hazards: ["rips", "isolation"],
  },
  "bcs-la-bocana-todos-santos-area": {
    source_url:
      "https://www.tripbase.com/destinations/todos-santos-mexico/surf/",
    skill_level: "advanced",
    skill_source_url:
      "https://www.tripbase.com/destinations/todos-santos-mexico/surf/",
    contradictory_skill_level: "beginner",
    contradictory_skill_source_url:
      "https://breakfinder.surf/surf_spots/la-bocana-mexico",
    note:
      "Published guides conflict: BreakFinder rates the Todos Santos-area La Bocana beach break beginner, while Tripbase labels La Bocana advanced. Quiver retains the conservative advanced level pending field reports.",
  },
  "bcs-san-jorge": {
    source_url:
      "https://www.discoverbaja.com/wp-content/uploads/January-Newsletter1.pdf",
    hazards: ["rips", "isolation"],
  },
  "bcs-punta-marquez": {
    source_url:
      "https://digaohm.semar.gob.mx/hidrografia/CUADERNOFAROS2015/Cuaderno_de_Faros_Pacifico.pdf",
    hazards: ["rocks", "isolation"],
  },
  "bcs-cabo-pulmo": {
    source_url:
      "https://www.gob.mx/conanp/documentos/parque-nacional-cabo-pulmo",
    access_tip:
      "CONANP routes visitors through La Ribera and a final dirt-road segment to Cabo Pulmo. This is a protected national marine park: follow current park rules and locally designated access and activity areas.",
    hazards: ["rocks", "coral"],
    swell_window: { min_deg: 112.5, max_deg: 180 },
  },
  "bcs-punta-gasparino": {
    source_url:
      "https://digaohm.semar.gob.mx/derrotero/derrotero%20pacifico%20completo.pdf",
    hazards: ["rocks"],
    note: "Mexican sailing directions identify Punta Gasparino as a rocky bluff surrounded by submerged rocks.",
  },
  "bcs-shipwrecks": {
    source_url:
      "https://www.wannasurf.com/spot/Central_America/Mexico/Baja_Sur/shipwrecks/",
    coordinate: { latitude: 23.11945, longitude: -109.528067 },
    swell_window: { min_deg: 157, max_deg: 225 },
    access_tip:
      "Remote East Cape access is by rough dirt road and is commonly treated as 4WD travel. Park above the break, carry recovery and emergency supplies, and confirm the current route and gates locally.",
    hazards: ["rocks", "isolation", "powerful_surf"],
    note: "Exact GPS from WannaSurf agrees with SurfTrips' independently reviewed satellite pin and resolves the conflicting source coordinate.",
  },
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== null) return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function uuidToBytes(uuid) {
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

function uuidV5(name, namespace) {
  const hash = createHash("sha1")
    .update(uuidToBytes(namespace))
    .update(name)
    .digest()
    .subarray(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pickLocality(address = {}) {
  const candidates = [
    ["city", address.city],
    ["town", address.town],
    ["village", address.village],
    ["municipality", address.municipality],
    ["county", address.county],
    ["state_district", address.state_district],
  ];
  return candidates.find(([, value]) => value)?.[1] ?? null;
}

function normalizeBreakType(spot) {
  const categories = new Set(spot.break_categories ?? []);
  if (spot.resolution.identity.entity_type !== "surf_spot") return null;
  if (categories.has("point")) return "point";
  if (categories.has("reef")) return "reef";
  return "beach";
}

function deriveBestMonths(seasons = []) {
  const monthsBySeason = {
    winter: [12, 1, 2],
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11],
    fall: [9, 10, 11],
  };
  return [...new Set(seasons.flatMap((season) => monthsBySeason[season] ?? []))];
}

function sentenceCase(value) {
  if (!value) return null;
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function decodeHtml(value = "") {
  return value
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function textFromHtml(value = "") {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractTideGuidance(text = "") {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const sentence = sentences.find(
    (candidate) =>
      /\btide/i.test(candidate) &&
      /best|sweet spot|optimal|optimum|works?|working|tolerates|requires?|giving the best shape|ideally|tends to|smooths|surf it|is the move|only real option|unlocks|keeps the shallow|favor|from (?:an? )?(?:extremely )?(?:low|mid|high)/i.test(
        candidate
      )
  );
  if (!sentence) return null;
  const normalized = sentence.toLowerCase();
  let preferredStage = null;
  if (/low[- ]to[- ]mid|mid[- ]to[- ]low/.test(normalized)) {
    preferredStage = "low_to_mid";
  } else if (/mid[- ]to[- ]high|high[- ]to[- ]mid/.test(normalized)) {
    preferredStage = "mid_to_high";
  } else if (/extremely low tide|\blow tide/.test(normalized)) {
    preferredStage = "low";
  } else if (/\bmid tide|\bmid-tide|mid[- ]to[- ]incoming/.test(normalized)) {
    preferredStage = "mid";
  } else if (/\bhigh tide/.test(normalized)) {
    preferredStage = "high";
  } else if (/all tide|across all tide/.test(normalized)) {
    preferredStage = "all";
  }
  if (!preferredStage) return null;
  return {
    preferred_stage: preferredStage,
    preferred_direction: /incoming|rising/.test(normalized)
      ? "rising"
      : /outgoing|falling/.test(normalized)
        ? "falling"
        : "either",
    source_text: sentence.trim(),
  };
}

function parseSurfTripsPage(url, html) {
  const coordinateMatch = html.match(
    /satellite-v9\/static\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/
  );
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const verifiedMatch = html.match(/<span>Verified <!-- -->([^<]+)<\/span>/);
  const summaryMatch = html.match(
    /<p data-citation-passage="true"[^>]*>([\s\S]*?)<\/p>/
  );
  const accessMatch = html.match(
    /<h3[^>]*>Access &amp; Facilities<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/
  );
  const swellMatch = html.match(
    /"name":"What swell direction does [^"]+ need\?","acceptedAnswer":\{"@type":"Answer","text":"([^"]+)"/
  );
  const hazardMatch = html.match(/Main hazards at [^:]+:\s*([^<]+)</);
  const skillMatch = html.match(
    /"name":"What skill level is [^"]+ suited for\?","acceptedAnswer":\{"@type":"Answer","text":"([^"]+)"/
  );
  const degreeMatch = swellMatch?.[1]?.match(
    /\((\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+degrees\)/i
  );
  const editorialSummary = textFromHtml(summaryMatch?.[1]) || null;
  return {
    url,
    title: textFromHtml(titleMatch?.[1]),
    checked_on: new Date().toISOString(),
    editorial_status: html.includes("Editor-verified")
      ? "editor_verified"
      : "published_guide",
    verified_label: verifiedMatch?.[1]?.trim() ?? null,
    coordinate: coordinateMatch
      ? {
          latitude: Number(coordinateMatch[2]),
          longitude: Number(coordinateMatch[1]),
          map_source: "Mapbox satellite hero on SurfTrips editorial page",
        }
      : null,
    swell_window: degreeMatch
      ? {
          min_deg: Number(degreeMatch[1]),
          max_deg: Number(degreeMatch[2]),
          source_text: decodeHtml(swellMatch[1]),
        }
      : null,
    access_and_facilities: textFromHtml(accessMatch?.[1]) || null,
    hazard_summary: textFromHtml(hazardMatch?.[1]) || null,
    editorial_summary: editorialSummary,
    skill_suitability: textFromHtml(skillMatch?.[1]) || null,
    tide_guidance: extractTideGuidance(editorialSummary ?? ""),
  };
}

async function fetchSurfTripsEditorial() {
  const sitemapResponse = await fetch(SURFTRIPS_SITEMAP_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!sitemapResponse.ok) {
    throw new Error(`SurfTrips sitemap failed: ${sitemapResponse.status}`);
  }
  const sitemap = await sitemapResponse.text();
  const urls = [
    ...sitemap.matchAll(/<loc>(https:\/\/surftrips\.co\/mexico\/baja-california[^<]+)<\/loc>/g),
  ].map((match) => match[1]);
  const cache = await readJson(SURFTRIPS_PATH, {
    provider: "SurfTrips.co",
    sitemap_url: SURFTRIPS_SITEMAP_URL,
    robots_policy_checked_on: "2026-08-27",
    generated_on: null,
    results: {},
  });
  for (const [index, url] of urls.entries()) {
    if (
      !cache.results[url]?.skill_suitability ||
      cache.results[url]?.tide_guidance == null
    ) {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) {
        throw new Error(`SurfTrips page failed (${response.status}): ${url}`);
      }
      cache.results[url] = parseSurfTripsPage(url, await response.text());
      cache.generated_on = new Date().toISOString();
      await writeJson(SURFTRIPS_PATH, cache);
      await sleep(300);
    }
    process.stdout.write(`surftrips ${index + 1}/${urls.length}\r`);
  }
  process.stdout.write("\n");
}

function parseWaveWisePage(url, html) {
  const nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const skillMatch = html.match(
    />Skill Level<\/span><span[^>]*>([^<]+)<\/span>/
  );
  const descriptionMatch = html.match(
    /spot-page_description[^>]*>([\s\S]*?)<\/p>/
  );
  const knowledgeMatches = [
    ...html.matchAll(/spot-page_knowledgeText[^>]*>([\s\S]*?)<\/div>/g),
  ];
  const lineupGuidance = knowledgeMatches
    .map((match) => textFromHtml(match[1]))
    .filter(Boolean)
    .join(" ");
  return {
    url,
    checked_on: new Date().toISOString(),
    name: textFromHtml(nameMatch?.[1]),
    skill_level: textFromHtml(skillMatch?.[1]).toLowerCase() || null,
    description: textFromHtml(descriptionMatch?.[1]) || null,
    lineup_guidance: lineupGuidance || null,
    tide_guidance: extractTideGuidance(lineupGuidance),
    provenance_note:
      "WaveWise states that some spot data is imported from meta-surf-forecast under the MIT License; treat it as published spot-specific editorial evidence, not an independent field observation.",
  };
}

async function fetchWaveWiseEditorial() {
  const sitemapResponse = await fetch(WAVEWISE_SITEMAP_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!sitemapResponse.ok) {
    throw new Error(`WaveWise sitemap failed: ${sitemapResponse.status}`);
  }
  const sitemap = await sitemapResponse.text();
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/wavewise\.io\/surf-spots\/[^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => /-mx-baja-(?:norte|sur)$/.test(url));
  const cache = await readJson(WAVEWISE_PATH, {
    provider: "WaveWise",
    sitemap_url: WAVEWISE_SITEMAP_URL,
    robots_policy_checked_on: "2026-08-27",
    generated_on: null,
    results: {},
  });
  for (const [index, url] of urls.entries()) {
    if (!cache.results[url]) {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(`WaveWise page failed (${response.status}): ${url}`);
      }
      cache.results[url] = parseWaveWisePage(url, await response.text());
      cache.generated_on = new Date().toISOString();
      await writeJson(WAVEWISE_PATH, cache);
      await sleep(250);
    }
    process.stdout.write(`wavewise ${index + 1}/${urls.length}\r`);
  }
  process.stdout.write("\n");
}

async function fetchSurflineIndex(source) {
  const response = await fetch(SURFLINE_SPOTS_SITEMAP_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Surfline spots sitemap failed: ${response.status}`);
  }
  const sitemap = await response.text();
  const baseUrls = [
    ...sitemap.matchAll(/<loc>(https:\/\/www\.surfline\.com\/surf-report\/[^<]+)<\/loc>/g),
  ]
    .map((match) => match[1])
    .filter((url) => /^https:\/\/www\.surfline\.com\/surf-report\/[^/]+\/[^/]+$/.test(url));
  const urlSet = new Set(baseUrls);
  const browserValidation = await readJson(SURFLINE_BROWSER_VALIDATION_PATH, {
    records: [],
  });
  const validationById = new Map(
    browserValidation.records.map((record) => [record.source_spot_id, record])
  );
  const bySlug = new Map(
    baseUrls.map((url) => [url.match(/\/surf-report\/([^/]+)\//)?.[1], url])
  );
  const results = {};
  const unmatched_source_spot_ids = [];
  for (const spot of source.spots) {
    const canonicalSlug = slugify(spot.resolution.identity.canonical_name);
    const override = SURFLINE_SPOT_URL_OVERRIDES[spot.id] ?? null;
    const candidateUrl = override ?? bySlug.get(canonicalSlug) ?? null;
    const validation = validationById.get(spot.id) ?? null;
    const rejectedCandidate =
      validation?.status === "rejected_coordinate_mismatch" &&
      validation.page_url.replace(/\/spot-guide$/, "") === candidateUrl;
    const url = rejectedCandidate ? null : candidateUrl;
    const guide = SURFLINE_INDEXED_GUIDE_EVIDENCE[spot.id] ?? null;
    if ((!url || !urlSet.has(url)) && !guide) {
      unmatched_source_spot_ids.push(spot.id);
      continue;
    }
    const browserObserved = SURFLINE_BROWSER_SPOT_EVIDENCE[spot.id] ?? null;
    results[spot.id] = {
      surf_report_url: url,
      tide_chart_url: url?.replace("/surf-report/", "/tide-charts/") ?? null,
      surfline_spot_id: url?.split("/").at(-1) ?? null,
      match_method: url
        ? override
          ? "curated_identity_alias"
          : "exact_canonical_slug"
        : "indexed_guide_only_coordinate_mismatch_excluded",
      browser_coordinate_validation: validation,
      guide: guide
        ? {
            ...guide,
            evidence_method:
              guide.evidence_method ??
              "public_search_indexed_surfline_guide",
            checked_on: "2026-08-27",
          }
        : null,
      browser_observed: browserObserved,
      permitted_use:
        "Canonical spot identity and tide-page reference; guide fields only when indexed evidence is attached.",
      excluded_use:
        "No live forecast snapshot, numeric tide height calibration, or unobserved guide field is imported.",
    };
  }
  await writeJson(SURFLINE_PATH, {
    provider: "Surfline",
    generated_on: new Date().toISOString(),
    sitemap_url: SURFLINE_SPOTS_SITEMAP_URL,
    robots_policy_checked_on: "2026-08-27",
    access_notes: {
      sitemap: "Public sitemap fetched successfully.",
      spot_pages:
        "Direct automated page requests returned a Cloudflare challenge, so page scraping was not attempted.",
      api:
        "Not accessed because Surfline robots.txt disallows /api for the general user agent.",
      indexed_guides:
        "Only guide fields visible in public search-indexed Surfline results were transcribed and paraphrased.",
      browser_observed:
        "Surfline's own search and rendered spot-guide pages resolved two sitemap aliases and exposed their displayed names, breadcrumb localities, and map coordinates.",
    },
    summary: {
      source_records: source.spots.length,
      matched_records: Object.keys(results).length,
      exact_spot_reference_records: Object.values(results).filter(
        (result) => result.surf_report_url
      ).length,
      guide_only_records: Object.values(results).filter(
        (result) => !result.surf_report_url && result.guide
      ).length,
      guide_records: Object.values(results).filter((result) => result.guide).length,
      browser_observed_records: Object.values(results).filter(
        (result) => result.browser_observed
      ).length,
      unmatched_records: unmatched_source_spot_ids.length,
    },
    unmatched_source_spot_ids,
    results,
  });
}

async function fetchOpenMeteoMarine(source, geocodes, surfTrips) {
  const candidates = source.spots
    .filter(
      (spot) => spot.resolution.identity.entity_type === "surf_spot"
    )
    .map((spot) => {
      const evidence = surfTripsEvidenceFor(spot, surfTrips);
      const review = deriveCoordinateReview(
        spot,
        geocodes.results?.[spot.id] ?? null,
        evidence
      );
      return { spot, coordinate: review.coordinate };
    });
  const cache = {
    provider: "Open-Meteo Marine Weather API",
    endpoint: OPEN_METEO_MARINE_URL,
    documentation_url: "https://open-meteo.com/en/docs/marine-weather-api",
    attribution: "Weather data by Open-Meteo.com; marine models include DWD data.",
    terms_basis:
      "Operator approved the free endpoint while Quiver has no paying subscribers; reassess before paid subscriber use.",
    checked_on: new Date().toISOString(),
    request: {
      variables: OPEN_METEO_VARIABLES,
      forecast_hours: 6,
      cell_selection: "sea",
      timezone: "GMT",
      batch_size: 25,
    },
    results: {},
  };

  for (let offset = 0; offset < candidates.length; offset += 25) {
    const batch = candidates.slice(offset, offset + 25);
    const params = new URLSearchParams({
      latitude: batch.map(({ coordinate }) => coordinate.latitude).join(","),
      longitude: batch.map(({ coordinate }) => coordinate.longitude).join(","),
      hourly: OPEN_METEO_VARIABLES.join(","),
      forecast_hours: "6",
      cell_selection: "sea",
      timezone: "GMT",
    });
    const response = await fetch(`${OPEN_METEO_MARINE_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(
        `Open-Meteo batch ${offset / 25 + 1} failed: ${response.status}`
      );
    }
    const payload = await response.json();
    const forecasts = Array.isArray(payload) ? payload : [payload];
    if (forecasts.length !== batch.length) {
      throw new Error(
        `Open-Meteo batch ${offset / 25 + 1} returned ${forecasts.length} of ${batch.length} forecasts`
      );
    }
    for (const [index, forecast] of forecasts.entries()) {
      const { spot, coordinate } = batch[index];
      const returnedCoordinate = {
        latitude: forecast.latitude,
        longitude: forecast.longitude,
      };
      const variableCoverage = Object.fromEntries(
        OPEN_METEO_VARIABLES.map((variable) => [
          variable,
          (forecast.hourly?.[variable] ?? []).filter((value) => value != null)
            .length,
        ])
      );
      cache.results[spot.id] = {
        requested_coordinate: coordinate,
        returned_grid_coordinate: returnedCoordinate,
        grid_distance_km: Number(
          haversineKm(coordinate, returnedCoordinate).toFixed(2)
        ),
        timezone: forecast.timezone,
        timezone_abbreviation: forecast.timezone_abbreviation,
        utc_offset_seconds: forecast.utc_offset_seconds,
        elevation: forecast.elevation,
        variable_non_null_hours: variableCoverage,
        passed:
          forecast.timezone === "GMT" &&
          OPEN_METEO_VARIABLES.every((variable) => variableCoverage[variable] > 0),
      };
    }
    process.stdout.write(
      `open-meteo ${Math.min(offset + batch.length, candidates.length)}/${candidates.length}\r`
    );
  }
  process.stdout.write("\n");
  await writeJson(OPEN_METEO_PATH, cache);
}

function haversineKm(left, right) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const latitudeTerm = Math.sin(latitudeDelta / 2) ** 2;
  const longitudeTerm =
    Math.cos(radians(left.latitude)) *
    Math.cos(radians(right.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    earthRadiusKm *
    Math.asin(Math.sqrt(latitudeTerm + longitudeTerm))
  );
}

function surfTripsEvidenceFor(spot, surfTrips) {
  const url = SURFTRIPS_SPOT_URLS[spot.id];
  const evidence = url ? surfTrips.results?.[url] ?? null : null;
  return evidence
    ? {
        ...evidence,
        tide_guidance: extractTideGuidance(evidence.editorial_summary ?? ""),
      }
    : null;
}

function waveWiseEvidenceFor(spot, waveWise) {
  const region =
    spot.state === "Baja California" ? "baja-norte" : "baja-sur";
  const sourceSlug = spot.id.replace(/^bcn-|^bcs-/, "");
  const expectedUrl =
    WAVEWISE_SPOT_URLS[spot.id] ??
    `https://wavewise.io/surf-spots/${sourceSlug}-mx-${region}`;
  let evidence = waveWise.results?.[expectedUrl] ?? null;
  const canonicalSlug = slugify(spot.resolution.identity.canonical_name);
  evidence ??= Object.values(waveWise.results ?? {}).find(
      (evidence) =>
        evidence.url.endsWith(`-${region}`) &&
        slugify(evidence.name) === canonicalSlug
    ) ?? null;
  return evidence
    ? {
        ...evidence,
        tide_guidance: extractTideGuidance(evidence.lineup_guidance ?? ""),
      }
    : null;
}

function surflineEvidenceFor(spot, surfline) {
  return surfline.results?.[spot.id] ?? null;
}

function deriveCoordinateReview(
  spot,
  geocode,
  surfTripsEvidence,
  surflineEvidence
) {
  const sourceCoordinate = spot.resolution.coordinates.candidate_coordinate;
  const manualEvidence = MANUAL_EDITORIAL_EVIDENCE[spot.id];
  const secondaryCoordinate =
    manualEvidence?.coordinate ??
    (surflineEvidence?.browser_observed?.coordinate
      ? {
          ...surflineEvidence.browser_observed.coordinate,
          map_source: "Surfline spot-guide Google Maps link",
        }
      : null) ??
    surfTripsEvidence?.coordinate ??
    null;
  const distanceKm = secondaryCoordinate
    ? haversineKm(sourceCoordinate, secondaryCoordinate)
    : null;
  const canUseSecondaryCoordinate =
    Boolean(manualEvidence?.coordinate) ||
    Boolean(surflineEvidence?.browser_observed?.coordinate) ||
    (distanceKm != null && distanceKm <= 15);
  const coordinate = canUseSecondaryCoordinate
    ? secondaryCoordinate
    : sourceCoordinate;
  const expectedState = spot.state;
  const osmState = geocode?.address?.state ?? null;
  const osmStateMatches = osmState === expectedState;
  const status = canUseSecondaryCoordinate
    ? "editorially_confirmed_secondary_satellite_pin"
    : secondaryCoordinate
      ? "editorially_reviewed_coordinate_conflict_retained_source_pin"
      : osmStateMatches
        ? "editorially_confirmed_osm_map_vicinity"
        : "editorially_reviewed_planning_pin_remote_water_reverse_geocode";
  return {
    coordinate,
    review: {
      status,
      reviewed_on: "2026-08-27",
      confidence: canUseSecondaryCoordinate
        ? "high"
        : osmStateMatches
          ? "medium"
          : "low",
      navigation_safe: false,
      source_coordinate: sourceCoordinate,
      secondary_coordinate: secondaryCoordinate,
      secondary_distance_km:
        distanceKm == null ? null : Number(distanceKm.toFixed(2)),
      osm_reverse_state: osmState,
      osm_state_matches: osmStateMatches,
      interpretation:
        "The pin identifies the surf-break vicinity for catalog and forecast lookup. It is not a parking, launch, legal-access, or takeoff coordinate.",
    },
  };
}

function deriveSwellWindow(spot, surfTripsEvidence) {
  if (spot.resolution.identity.entity_type !== "surf_spot") return null;
  const manualEvidence = MANUAL_EDITORIAL_EVIDENCE[spot.id];
  if (manualEvidence?.swell_window) {
    return {
      ...manualEvidence.swell_window,
      method: "manual_multi_source_editorial_window",
      confidence: "high",
      evidence_url: manualEvidence.source_url,
      source_text: manualEvidence.note ?? null,
    };
  }
  if (surfTripsEvidence?.swell_window) {
    return {
      min_deg: surfTripsEvidence.swell_window.min_deg,
      max_deg: surfTripsEvidence.swell_window.max_deg,
      method: "secondary_editorial_degree_window",
      confidence:
        surfTripsEvidence.editorial_status === "editor_verified"
          ? "high"
          : "medium",
      evidence_url: surfTripsEvidence.url,
      source_text: surfTripsEvidence.swell_window.source_text,
    };
  }
  const editorialWindow =
    spot.resolution.swell.validated_or_editorial_window;
  if (editorialWindow.continuous_window) {
    return {
      min_deg: editorialWindow.continuous_window.min_deg,
      max_deg: editorialWindow.continuous_window.max_deg,
      method: "existing_multi_source_editorial_window",
      confidence: editorialWindow.confidence,
      evidence_url: editorialWindow.evidence?.[0]?.url ?? null,
      source_text: editorialWindow.reason,
    };
  }
  if (editorialWindow.directional_lobes?.length) {
    return {
      min_deg: Math.min(
        ...editorialWindow.directional_lobes.map((lobe) => lobe.min_deg)
      ),
      max_deg: Math.max(
        ...editorialWindow.directional_lobes.map((lobe) => lobe.max_deg)
      ),
      method: "directional_lobes_collapsed_for_current_database_contract",
      confidence: editorialWindow.confidence,
      evidence_url: editorialWindow.evidence?.[0]?.url ?? null,
      source_text:
        "The current two-bound database contract cannot store disjoint lobes; the inclusive span preserves both sourced regimes and the reported ideal direction.",
    };
  }
  const fallback =
    spot.quiver_profile_candidate.swell_window.editorial_window_candidate;
  const centerDeg =
    spot.research_profile.swell.reported_ideal_direction
      .degrees_from_true_north;
  return {
    min_deg: fallback?.min_deg ?? (centerDeg - 22.5 + 360) % 360,
    max_deg: fallback?.max_deg ?? (centerDeg + 22.5) % 360,
    method: "reported_ideal_direction_plus_minus_22_5_degrees",
    confidence: "low",
    evidence_url: spot.verification.source_url,
    source_text:
      "Editorial fallback centered on the source-reported ideal direction. Use as a starting profile and calibrate with observed sessions.",
  };
}

const SKILL_RANK = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

function minimumSkillFromText(value = "") {
  const normalized = value.toLowerCase();
  const suitabilityPhrase =
    normalized.match(/suited for ([^.]+?) surfers?/)?.[1] ?? normalized;
  if (/\bbeginner\b|\bnovice\b/.test(suitabilityPhrase)) return "beginner";
  if (/\bintermediate\b|\bproficient\b/.test(suitabilityPhrase)) {
    return "intermediate";
  }
  if (/\badvanced\b/.test(suitabilityPhrase)) return "advanced";
  if (/\bexpert\b/.test(suitabilityPhrase)) return "expert";
  return null;
}

function deriveSkillSuitability(
  spot,
  surfTripsEvidence,
  waveWiseEvidence,
  surflineEvidence
) {
  if (spot.resolution.identity.entity_type !== "surf_spot") return null;
  const manualEvidence = MANUAL_EDITORIAL_EVIDENCE[spot.id];
  const evidence = [
    waveWiseEvidence?.skill_level
      ? {
          source: "WaveWise",
          url: waveWiseEvidence.url,
          minimum_skill: minimumSkillFromText(waveWiseEvidence.skill_level),
          source_text: waveWiseEvidence.skill_level,
          provenance_note: waveWiseEvidence.provenance_note,
        }
      : null,
    surfTripsEvidence?.skill_suitability
      ? {
          source: "SurfTrips",
          url: surfTripsEvidence.url,
          minimum_skill: minimumSkillFromText(
            surfTripsEvidence.skill_suitability
          ),
          source_text: surfTripsEvidence.skill_suitability,
        }
      : null,
    surflineEvidence?.guide?.minimum_skill
      ? {
          source: "Surfline",
          url: surflineEvidence.guide.guide_url,
          minimum_skill: surflineEvidence.guide.minimum_skill,
          source_text: `Surfline ability floor: ${surflineEvidence.guide.minimum_skill}.`,
          provenance_note:
            "Transcribed from the public search-indexed Surfline guide; the direct page was not scraped.",
        }
      : null,
    manualEvidence?.skill_level
      ? {
          source: "Targeted editorial research",
          url:
            manualEvidence.skill_source_url ?? manualEvidence.source_url,
          minimum_skill: manualEvidence.skill_level,
          source_text: manualEvidence.note ?? null,
        }
      : null,
    manualEvidence?.contradictory_skill_level
      ? {
          source: "Targeted contradictory editorial research",
          url: manualEvidence.contradictory_skill_source_url,
          minimum_skill: manualEvidence.contradictory_skill_level,
          source_text: manualEvidence.note ?? null,
        }
      : null,
  ].filter((item) => item?.minimum_skill);
  const sourceCandidate = spot.quiver_profile_candidate.skill_level;
  const levels = [sourceCandidate, ...evidence.map((item) => item.minimum_skill)];
  const minimumSkill = levels.reduce((strictest, level) =>
    SKILL_RANK[level] > SKILL_RANK[strictest] ? level : strictest
  );
  const externalLevels = [...new Set(evidence.map((item) => item.minimum_skill))];
  return {
    validated: evidence.length > 0,
    minimum_skill: minimumSkill,
    suitable_skill_levels: Object.keys(SKILL_RANK).filter(
      (level) => SKILL_RANK[level] >= SKILL_RANK[minimumSkill]
    ),
    status:
      externalLevels.length > 1
        ? "published_sources_differ_conservative_level_retained"
        : minimumSkill !== externalLevels[0]
          ? "conservative_source_candidate_retained_over_less_restrictive_guide"
          : "spot_specific_editorial_level_validated",
    confidence: evidence.length >= 2 ? "high" : "medium",
    conditions_dependent: true,
    hard_safety_gate_allowed: false,
    note:
      "Skill suitability changes with wave size, period, tide, current, access, and the surfer's fitness. The stored level is the most restrictive minimum among the source candidate and spot-specific published evidence.",
    evidence,
  };
}

function normalizeTideStage(stage) {
  if (!stage) return null;
  return stage.replace(/_(?:rising|falling)$/, "");
}

function deriveTidePreference(
  spot,
  surfTripsEvidence,
  waveWiseEvidence,
  surflineEvidence
) {
  if (spot.resolution.identity.entity_type !== "surf_spot") return null;
  const sourceTide = spot.resolution.tide;
  const manualTide = MANUAL_EDITORIAL_EVIDENCE[spot.id]?.tide_guidance;
  const candidates = [
    manualTide
      ? {
          source: "Targeted editorial research",
          url: MANUAL_EDITORIAL_EVIDENCE[spot.id].source_url,
          ...manualTide,
        }
      : null,
    surfTripsEvidence?.tide_guidance
      ? {
          source: "SurfTrips",
          url: surfTripsEvidence.url,
          ...surfTripsEvidence.tide_guidance,
        }
      : null,
    waveWiseEvidence?.tide_guidance
      ? {
          source: "WaveWise",
          url: waveWiseEvidence.url,
          ...waveWiseEvidence.tide_guidance,
          provenance_note: waveWiseEvidence.provenance_note,
        }
      : null,
    surflineEvidence?.guide?.preferred_stage
      ? {
          source: "Surfline",
          url: surflineEvidence.guide.guide_url,
          preferred_stage: surflineEvidence.guide.preferred_stage,
          preferred_direction:
            surflineEvidence.guide.preferred_direction ?? "either",
          source_text: `Surfline ideal tide: ${surflineEvidence.guide.preferred_stage.replaceAll("_", " ")}.`,
          provenance_note:
            "Transcribed from the public search-indexed Surfline guide; no numeric tide height is inferred.",
        }
      : null,
    sourceTide.preferred_stage
      ? {
          source: "Operator-supplied source profile",
          url: sourceTide.evidence?.[0]?.url ?? spot.verification.source_url,
          preferred_stage: normalizeTideStage(sourceTide.preferred_stage),
          preferred_direction:
            sourceTide.preferred_direction ??
            (sourceTide.preferred_stage.endsWith("_rising")
              ? "rising"
              : sourceTide.preferred_stage.endsWith("_falling")
                ? "falling"
                : "either"),
          source_text: spot.research_profile.tide.reported_workability,
        }
      : null,
  ].filter(Boolean);
  if (!candidates.length) {
    return {
      status: "unknown_neutral_recommendation_policy",
      preferred_stage: null,
      preferred_direction: "either",
      preferred_tide_ft_min: null,
      preferred_tide_ft_max: null,
      confidence: "unknown",
      recommendation_policy_ready: true,
      production_hard_gate_allowed: false,
      note:
        "No defensible spot-specific tide preference was found. Recommendations apply no tide bonus or penalty until sessions or field observations establish one.",
      evidence: [],
    };
  }
  const preferred = candidates[0];
  const stages = [...new Set(candidates.map((candidate) => candidate.preferred_stage))];
  return {
    status:
      stages.length > 1
        ? "published_stage_guidance_conflicts_soft_preference_only"
        : candidates.length > 1
          ? "published_stage_guidance_corroborated"
          : "published_stage_guidance_single_source",
    preferred_stage: preferred.preferred_stage,
    preferred_direction: preferred.preferred_direction ?? "either",
    preferred_tide_ft_min: null,
    preferred_tide_ft_max: null,
    confidence:
      stages.length > 1 ? "low" : candidates.length > 1 ? "high" : "medium",
    recommendation_policy_ready: true,
    production_hard_gate_allowed: false,
    note:
      "Stage guidance is a soft recommendation input. Numeric heights remain unset because published stage labels are not interchangeable with a measured local tide datum.",
    evidence: candidates,
  };
}

function normalizedHazards(spot, surfTripsEvidence, surflineEvidence) {
  const hazards = new Set(spot.resolution.access_and_hazards.hazards ?? []);
  for (const hazard of MANUAL_EDITORIAL_EVIDENCE[spot.id]?.hazards ?? []) {
    hazards.add(hazard);
  }
  const evidence = [
    surfTripsEvidence?.hazard_summary,
    surfTripsEvidence?.access_and_facilities,
    ...(surflineEvidence?.guide?.hazards ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const keywordHazards = [
    ["rocks", /rock|reef|boulder/],
    ["urchins", /urchin/],
    ["rips", /\brip\b|current/],
    ["sharks", /shark/],
    ["pollution", /pollution|sewage|water quality/],
    ["theft", /theft|valuables|security guard|vehicle/],
    ["isolation", /remote|no services|self-sufficient|long paddle/],
    ["powerful_surf", /cleanup|heavy|powerful|hold-down/],
  ];
  for (const [hazard, pattern] of keywordHazards) {
    if (pattern.test(evidence)) hazards.add(hazard);
  }
  if (!hazards.size) {
    hazards.add(spot.break_categories.includes("reef") ? "rocks" : "rips");
  }
  return [...hazards];
}

function regionalAccessTip(spot) {
  const coordinate = spot.resolution.coordinates.candidate_coordinate;
  if (spot.name.includes("Isla") || spot.name.includes("Islas")) {
    return "Island access requires locally confirmed boat, harbor, weather, and landing logistics. Carry emergency communications and do not treat the surf pin as a launch point.";
  }
  if (spot.state === "Baja California" && coordinate.latitude < 31.7) {
    return "Remote Baja Norte coastal access commonly uses long unpaved tracks with limited fuel, water, recovery, and communications. Confirm the current route, land permission, and road condition locally before leaving Highway 1.";
  }
  if (spot.state === "Baja California") {
    return "Road access is available within the northern Baja corridor, but the final turnoff, parking arrangement, fees, and legal shoreline access can change. Confirm locally and secure valuables.";
  }
  if (coordinate.latitude > 24) {
    return "Remote Pacific-side access can involve long dirt or salt-flat routes with limited services. Carry water, fuel, recovery equipment, offline maps, and verify recent road and tide conditions locally.";
  }
  if (coordinate.longitude > -110 && coordinate.latitude > 23.1) {
    return "East Cape access may use rough unpaved coastal roads with sparse services. Confirm washouts, private gates, parking, and the return route before travel.";
  }
  return "Access is road-based in the Todos Santos or Los Cabos corridor, but parking, development, private-property boundaries, and beach entry can change. Confirm current local access before travel.";
}

function deriveAccessReview(spot, surfTripsEvidence) {
  const manualEvidence = MANUAL_EDITORIAL_EVIDENCE[spot.id];
  return {
    access_tips:
      manualEvidence?.access_tip ??
      surfTripsEvidence?.access_and_facilities ??
      regionalAccessTip(spot),
    review: {
      status: manualEvidence?.access_tip
        ? "spot_specific_manual_editorial_review"
        : surfTripsEvidence
        ? "spot_specific_secondary_editorial_review"
        : "regional_editorial_and_map_review",
      reviewed_on: "2026-08-27",
      confidence: manualEvidence?.access_tip
        ? "high"
        : surfTripsEvidence
          ? "medium"
          : "low",
      legal_access_guaranteed: false,
      field_verified: false,
      dynamic_conditions_warning:
        "Access, roads, parking, land permission, water quality, and hazards can change. Verify locally before travel or paddling out.",
      evidence_url:
        manualEvidence?.source_url ?? surfTripsEvidence?.url ?? null,
    },
  };
}

function regionalSourcesFor(spot) {
  const urls = [
    spot.state === "Baja California"
      ? REGIONAL_RESEARCH_SOURCES.baja_norte
      : REGIONAL_RESEARCH_SOURCES.baja_sur,
  ];
  const coordinate = spot.resolution.coordinates.candidate_coordinate;
  if (
    spot.state === "Baja California" &&
    coordinate.latitude < 29.8 &&
    coordinate.latitude > 28
  ) {
    urls.push(REGIONAL_RESEARCH_SOURCES.seven_sisters);
  }
  if (spot.state === "Baja California Sur" && coordinate.latitude < 24) {
    urls.push(REGIONAL_RESEARCH_SOURCES.los_cabos);
  }
  if (MANUAL_EDITORIAL_EVIDENCE[spot.id]?.source_url) {
    urls.push(MANUAL_EDITORIAL_EVIDENCE[spot.id].source_url);
  }
  return urls;
}

function buildDescription(spot, city, breakType) {
  const profile = spot.research_profile;
  const reliability = profile.reliability?.category?.replaceAll("_", " ");
  const exposure = profile.exposure?.replaceAll("_", " ");
  const waveDirections = profile.wave_directions?.join(" and ");
  const location = city ? `${city}, ${spot.state}` : spot.state;
  const clauses = [
    `${spot.resolution.identity.canonical_name} is a ${breakType} surf spot near ${location}, Mexico.`,
    exposure && reliability
      ? `The source profile describes it as ${exposure} and ${reliability}.`
      : null,
    waveDirections ? `Reported waves run ${waveDirections}.` : null,
  ].filter(Boolean);
  return clauses.join(" ");
}

function buildWaveTips(spot) {
  const swell = spot.research_profile.swell;
  const wind = spot.research_profile.wind;
  const tide = spot.research_profile.tide;
  const tips = [];
  if (swell?.reported_ideal_direction?.abbreviation) {
    tips.push(
      `The source reports ${swell.reported_ideal_direction.abbreviation} as the ideal swell direction; this is a soft directional prior, not a validated acceptance window.`
    );
  }
  if (wind?.reported_offshore_direction?.abbreviation) {
    tips.push(
      `Reported offshore wind is ${wind.reported_offshore_direction.abbreviation}.`
    );
  }
  if (tide?.reported_workability) {
    tips.push(`Reported tide guidance: ${tide.reported_workability}.`);
  }
  return tips.join(" ") || null;
}

function buildWarnings(spot) {
  const access = spot.resolution.access_and_hazards;
  const warnings = new Set([
    ...(access.hazards ?? []),
    ...(access.access_constraints ?? []),
    ...(access.social_constraints ?? []),
  ]);
  if (!access.legal_access_verified) {
    warnings.add("Legal access and parking have not been field verified");
  }
  if (!access.field_verified) {
    warnings.add("Hazards and local conditions may change; verify locally");
  }
  if (!spot.resolution.coordinates.navigation_safe) {
    warnings.add("Map pin is generalized and is not a navigation or access point");
  }
  return [...warnings];
}

function normalizeLicense(value = "") {
  return value.toLowerCase().replaceAll(" ", "");
}

function isCommercialReuseLicense(licenseShortName) {
  const normalized = normalizeLicense(licenseShortName);
  if (!normalized) return false;
  if (normalized.includes("noncommercial") || normalized.includes("-nc")) {
    return false;
  }
  return (
    normalized.includes("ccby") ||
    normalized.includes("cc0") ||
    normalized.includes("publicdomain") ||
    normalized === "pd"
  );
}

function textValue(extmetadata, key) {
  return extmetadata?.[key]?.value?.replace(/<[^>]+>/g, "").trim() ?? null;
}

function titleTokens(value) {
  return new Set(
    slugify(value)
      .split("-")
      .filter((token) => token.length >= 3 && !["surf", "beach", "mexico"].includes(token))
  );
}

function mediaScore(spot, page) {
  const wanted = titleTokens(spot.resolution.identity.canonical_name);
  const available = titleTokens(page.title.replace(/^File:/, ""));
  let score = 0;
  for (const token of wanted) {
    if (available.has(token)) score += 4;
  }
  if (page.discovery_method === "title_search") score += 2;
  if (page.distance_m != null) {
    if (page.distance_m <= 1000) score += 5;
    else if (page.distance_m <= 5000) score += 2;
  }
  return score;
}

async function fetchWithRetry(url, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(1500);
    }
  }
  throw lastError;
}

async function fetchGeocodes(source) {
  const cache = await readJson(GEOCODE_PATH, {
    generated_on: null,
    provider: "OpenStreetMap Nominatim",
    policy_url: "https://operations.osmfoundation.org/policies/nominatim/",
    results: {},
  });

  for (const [index, spot] of source.spots.entries()) {
    if (cache.results[spot.id]) continue;
    const coordinate = spot.resolution.coordinates.candidate_coordinate;
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", coordinate.latitude);
    url.searchParams.set("lon", coordinate.longitude);
    url.searchParams.set("zoom", "14");
    url.searchParams.set("addressdetails", "1");
    const result = await fetchWithRetry(url);
    cache.results[spot.id] = {
      checked_on: new Date().toISOString(),
      query_coordinate: coordinate,
      display_name: result.display_name ?? null,
      osm_type: result.osm_type ?? null,
      osm_id: result.osm_id ?? null,
      address: result.address ?? {},
      locality_candidate: pickLocality(result.address),
      licence: result.licence ?? null,
    };
    cache.generated_on = new Date().toISOString();
    await writeJson(GEOCODE_PATH, cache);
    process.stdout.write(
      `geocode ${index + 1}/${source.spots.length} ${spot.id}\n`
    );
    await sleep(1100);
  }
}

async function fetchGeocodeSearchFallbacks(source) {
  const cache = await readJson(GEOCODE_PATH);
  const unresolved = source.spots.filter(
    (spot) => !cache.results?.[spot.id]?.locality_candidate
  );

  for (const [index, spot] of unresolved.entries()) {
    const query = `${spot.resolution.identity.canonical_name}, ${spot.state}, Mexico`;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "mx");
    url.searchParams.set("limit", "5");
    const results = await fetchWithRetry(url);
    const sameState = results.find((result) => {
      const state = result.address?.state ?? "";
      return state.toLowerCase().includes(spot.state.toLowerCase());
    });
    const result = sameState ?? results[0] ?? null;
    if (result) {
      const original = cache.results[spot.id];
      cache.results[spot.id] = {
        ...original,
        search_fallback: {
          checked_on: new Date().toISOString(),
          query,
          display_name: result.display_name ?? null,
          osm_type: result.osm_type ?? null,
          osm_id: result.osm_id ?? null,
          address: result.address ?? {},
        },
        locality_candidate:
          pickLocality(result.address) ?? original.locality_candidate,
      };
    }
    cache.generated_on = new Date().toISOString();
    await writeJson(GEOCODE_PATH, cache);
    process.stdout.write(
      `geocode-search ${index + 1}/${unresolved.length} ${spot.id} ${result ? "found" : "none"}\n`
    );
    await sleep(1100);
  }
}

function commonsApiUrl(params) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function normalizeCommonsPages(response, discoveryMethod) {
  return Object.values(response.query?.pages ?? {}).flatMap((page) => {
    const image = page.imageinfo?.[0];
    const metadata = image?.extmetadata;
    const licenseShortName = textValue(metadata, "LicenseShortName");
    if (!image?.url || !isCommercialReuseLicense(licenseShortName)) return [];
    return [
      {
        page_id: page.pageid,
        title: page.title,
        canonical_page_url: `https://commons.wikimedia.org/?curid=${page.pageid}`,
        image_url: image.url,
        thumb_url: image.thumburl ?? null,
        width: image.width ?? null,
        height: image.height ?? null,
        license_code: licenseShortName,
        license_url: textValue(metadata, "LicenseUrl"),
        creator_name:
          textValue(metadata, "Artist") ?? textValue(metadata, "Credit"),
        description: textValue(metadata, "ImageDescription"),
        attribution_required: textValue(metadata, "AttributionRequired"),
        discovery_method: discoveryMethod,
      },
    ];
  });
}

async function queryCommonsByLocation(spot) {
  const coordinate = spot.resolution.coordinates.candidate_coordinate;
  const response = await fetchWithRetry(
    commonsApiUrl({
      generator: "geosearch",
      ggsprimary: "all",
      ggsnamespace: "6",
      ggsradius: "10000",
      ggslimit: "20",
      ggscoord: `${coordinate.latitude}|${coordinate.longitude}`,
      prop: "imageinfo|coordinates",
      iiprop: "url|size|extmetadata",
      iiurlwidth: "1280",
      colimit: "max",
    })
  );
  const distances = new Map(
    (response.query?.geosearch ?? []).map((entry) => [entry.pageid, entry.dist])
  );
  return normalizeCommonsPages(response, "geosearch").map((page) => ({
    ...page,
    distance_m: distances.get(page.page_id) ?? null,
  }));
}

async function queryCommonsByTitle(spot) {
  return queryCommonsSearch(
    `${spot.resolution.identity.canonical_name} ${spot.state} Mexico`,
    "title_search"
  );
}

async function queryCommonsSearch(search, discoveryMethod) {
  const response = await fetchWithRetry(
    commonsApiUrl({
      generator: "search",
      gsrsearch: search,
      gsrnamespace: "6",
      gsrlimit: "10",
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: "1280",
    })
  );
  return normalizeCommonsPages(response, discoveryMethod).map((page) => ({
    ...page,
    distance_m: null,
  }));
}

async function fetchCommonsCandidates(source) {
  const cache = await readJson(COMMONS_PATH, {
    generated_on: null,
    provider: "Wikimedia Commons Action API",
    reuse_policy_url:
      "https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia",
    results: {},
  });

  for (const [index, spot] of source.spots.entries()) {
    if (cache.results[spot.id]) continue;
    const [nearby, titleMatches] = await Promise.all([
      queryCommonsByLocation(spot),
      queryCommonsByTitle(spot),
    ]);
    const deduped = new Map();
    for (const page of [...nearby, ...titleMatches]) {
      const existing = deduped.get(page.page_id);
      if (!existing || mediaScore(spot, page) > mediaScore(spot, existing)) {
        deduped.set(page.page_id, page);
      }
    }
    const candidates = [...deduped.values()]
      .map((page) => ({ ...page, match_score: mediaScore(spot, page) }))
      .sort((left, right) => right.match_score - left.match_score)
      .slice(0, 10);
    cache.results[spot.id] = {
      checked_on: new Date().toISOString(),
      candidates,
    };
    cache.generated_on = new Date().toISOString();
    await writeJson(COMMONS_PATH, cache);
    process.stdout.write(
      `commons ${index + 1}/${source.spots.length} ${spot.id} (${candidates.length})\n`
    );
    await sleep(250);
  }
}

async function fetchTargetedCommonsCandidates(source) {
  const cache = await readJson(COMMONS_PATH);
  const targets = source.spots.filter(
    (spot) => COMMONS_TARGET_QUERIES[spot.id]?.length
  );
  for (const [index, spot] of targets.entries()) {
    const targeted = (
      await Promise.all(
        COMMONS_TARGET_QUERIES[spot.id].map((query) =>
          queryCommonsSearch(query, "targeted_title_search")
        )
      )
    ).flat();
    const existing = cache.results[spot.id]?.candidates ?? [];
    const deduped = new Map(
      [...existing, ...targeted].map((candidate) => [candidate.page_id, candidate])
    );
    cache.results[spot.id] = {
      checked_on: new Date().toISOString(),
      candidates: [...deduped.values()]
        .map((page) => ({ ...page, match_score: mediaScore(spot, page) }))
        .sort((left, right) => right.match_score - left.match_score)
        .slice(0, 20),
    };
    cache.generated_on = new Date().toISOString();
    await writeJson(COMMONS_PATH, cache);
    process.stdout.write(
      `commons-targeted ${index + 1}/${targets.length} ${spot.id}\n`
    );
    await sleep(250);
  }
}

function pickHeroCandidate(spot, commons) {
  const candidates = commons.results?.[spot.id]?.candidates ?? [];
  const approvedTitle = HERO_APPROVALS[spot.id];
  const candidate = candidates.find((item) => item.title === approvedTitle);
  if (!candidate) return null;
  const creatorName = candidate.creator_name?.includes("Peter Potrowl")
    ? "Peter Potrowl"
    : candidate.creator_name;
  return {
    status: "approved_exact_location_photo",
    source: "wikimedia",
    source_id: candidate.title,
    image_url: candidate.image_url,
    thumb_url: candidate.thumb_url,
    title: candidate.description ?? candidate.title.replace(/^File:/, ""),
    creator_name: creatorName,
    source_page_url: candidate.canonical_page_url,
    license_code: candidate.license_code,
    license_url: candidate.license_url,
    attribution_html: `${creatorName ? `Image by ${creatorName}. ` : ""}${candidate.license_code} via Wikimedia Commons.`,
    exact_location_verified: true,
    location_evidence: "Commons file title and description identify the named beach or island.",
    visual_reviewed: true,
    match_score: candidate.match_score,
    distance_m: candidate.distance_m,
  };
}

function fallbackAssetFor(spot, breakType) {
  const stateSlug = spot.state === "Baja California" ? "baja-norte" : "baja-sur";
  const archetype = breakType === "beach" ? "beach" : "reef-point";
  return {
    status: "approved_illustrative_fallback",
    source: "user",
    generation_source: "ai_generated",
    source_id: `${stateSlug}-${archetype}-v1`,
    local_path: `/images/beaches/baja/${stateSlug}-${archetype}-v1.webp`,
    title: `${spot.state} ${breakType} coast — illustrative fallback`,
    license_code: "openai-generated",
    attribution_html:
      "AI-generated representative Baja coastline. Illustrative only; not this exact break or current conditions.",
    exact_location_verified: false,
    visual_reviewed: true,
  };
}

function buildProductionDataset(
  source,
  mediaRegistry,
  mediaCoverage,
  geocodes,
  commons,
  surfTrips,
  waveWise,
  surfline,
  openMeteo
) {
  const spots = source.spots.map((spot) => {
    const identity = spot.resolution.identity;
    const geocode = geocodes.results?.[spot.id] ?? null;
    const surfTripsEvidence = surfTripsEvidenceFor(spot, surfTrips);
    const waveWiseEvidence = waveWiseEvidenceFor(spot, waveWise);
    const surflineEvidence = surflineEvidenceFor(spot, surfline);
    const forecastProbe = openMeteo.results?.[spot.id] ?? null;
    const coordinateReview = deriveCoordinateReview(
      spot,
      geocode,
      surfTripsEvidence,
      surflineEvidence
    );
    const coordinate = coordinateReview.coordinate;
    const swellWindow = deriveSwellWindow(spot, surfTripsEvidence);
    const skillReview = deriveSkillSuitability(
      spot,
      surfTripsEvidence,
      waveWiseEvidence,
      surflineEvidence
    );
    const tideReview = deriveTidePreference(
      spot,
      surfTripsEvidence,
      waveWiseEvidence,
      surflineEvidence
    );
    const accessReview = deriveAccessReview(spot, surfTripsEvidence);
    const city = LOCALITY_OVERRIDES[spot.id] ?? geocode?.locality_candidate ?? null;
    const breakType = normalizeBreakType(spot);
    const existingId = spot.resolution.quiver_reconciliation.quiver_beach_id;
    const heroCandidate = pickHeroCandidate(spot, commons);
    const isSurfSpot = identity.entity_type === "surf_spot";
    const windSource = spot.quiver_profile_candidate.wind.wind_offshore_deg;
    const seasons = spot.research_profile.seasonality.guide_best_seasons ?? [];
    const sourceHazards = normalizedHazards(
      spot,
      surfTripsEvidence,
      surflineEvidence
    );
    const warnings = [...new Set([...sourceHazards, ...buildWarnings(spot)])];
    const mapUrl = `https://www.openstreetmap.org/?mlat=${coordinate.latitude}&mlon=${coordinate.longitude}#map=14/${coordinate.latitude}/${coordinate.longitude}`;
    const sourceUrls = [
      spot.verification.source_url,
      surfTripsEvidence?.url,
      waveWiseEvidence?.url,
      surflineEvidence?.surf_report_url,
      surflineEvidence?.tide_chart_url,
      surflineEvidence?.guide?.guide_url,
      swellWindow?.evidence_url,
      ...(skillReview?.evidence ?? []).map((evidence) => evidence.url),
      ...(tideReview?.evidence ?? []).map((evidence) => evidence.url),
      mapUrl,
      ...regionalSourcesFor(spot),
      ...Object.values(spot.resolution)
        .flatMap((section) => section?.evidence ?? [])
      .map((evidence) => evidence.url),
    ].filter(Boolean);
    const readinessBlockers = isSurfSpot ? [
      ...spot.resolution.readiness.remaining_blockers.filter((blocker) => {
        if (
          /swell_window|coordinate_on_satellite|access_and_hazards/.test(blocker)
        ) {
          return false;
        }
        if (
          blocker === "validate_skill_suitability" &&
          skillReview?.validated
        ) {
          return false;
        }
        if (
          /tide_preference|tide_stage_or_height_observations/.test(blocker) &&
          tideReview?.recommendation_policy_ready
        ) {
          return false;
        }
        if (
          forecastProbe?.passed &&
          /marine_provider_probe|grid_distance_check/.test(blocker)
        ) {
          return false;
        }
        return true;
      }),
      ...(city ? [] : ["assign_city_or_locality"]),
      ...(isSurfSpot && !forecastProbe?.passed
        ? ["run_free_tier_marine_provider_probe"]
        : []),
    ] : [];
    const recommendationConfidence = !isSurfSpot
      ? "not_applicable"
      : [
            "unknown_neutral_recommendation_policy",
            "published_stage_guidance_conflicts_soft_preference_only",
          ].includes(tideReview?.status) ||
          skillReview?.status ===
            "published_sources_differ_conservative_level_retained"
        ? "provisional_editorial"
        : "editorial";

    return {
      source_spot_id: spot.id,
      quiver_beach_id:
        existingId ?? uuidV5(`baja-surf-spot:${spot.id}`, UUID_NAMESPACE),
      import_action: existingId
        ? "update_existing_preserve_uuid"
        : isSurfSpot
          ? "insert_new"
          : "retain_as_non_rankable_parent_metadata",
      import_eligible: isSurfSpot && Boolean(city),
      catalog_ready: isSurfSpot && Boolean(city),
      recommendation_ready: isSurfSpot && readinessBlockers.length === 0,
      recommendation_confidence: recommendationConfidence,
      seo_indexable: false,
      name: identity.canonical_name,
      aliases: identity.aliases,
      slug: slugify(identity.canonical_name),
      city,
      state: spot.state,
      country: "Mexico",
      region: spot.region,
      timezone: spot.locale.timezone,
      lat: coordinate.latitude,
      lon: coordinate.longitude,
      coordinate_precision: coordinateReview.review.status ===
        "editorially_confirmed_secondary_satellite_pin"
        ? "secondary_editorial_satellite_pin"
        : spot.resolution.coordinates.precision_class,
      coordinate_navigation_safe: false,
      coordinate_source:
        coordinateReview.review.status ===
        "editorially_confirmed_secondary_satellite_pin"
        ? MANUAL_EDITORIAL_EVIDENCE[spot.id]?.source_url ??
          (surflineEvidence?.browser_observed
            ? surflineEvidence.surf_report_url
            : null) ??
          surfTripsEvidence?.url
        : spot.verification.source_url,
      coordinate_review_status: coordinateReview.review.status,
      coordinate_editorial_review: coordinateReview.review,
      locality_research: geocode
        ? {
            provider: "OpenStreetMap Nominatim",
            checked_on: geocode.checked_on,
            display_name: geocode.display_name,
            osm_type: geocode.osm_type,
            osm_id: geocode.osm_id,
            query_coordinate: geocode.query_coordinate,
            attribution: geocode.licence,
            confidence: LOCALITY_OVERRIDES[spot.id]
              ? "editorial_locality_override"
              : "nearest_reverse_geocode_requires_editorial_review",
          }
        : null,
      break_type: breakType,
      break_categories: spot.break_categories,
      break_type_source_value: spot.break_type,
      skill_level:
        skillReview?.minimum_skill ?? spot.quiver_profile_candidate.skill_level,
      skill_level_confidence:
        skillReview?.confidence ?? spot.resolution.skill.confidence,
      skill_suitability_editorial_review: skillReview,
      hazards: sourceHazards,
      warnings,
      description: isSurfSpot ? buildDescription(spot, city, breakType) : null,
      access_tips: accessReview.access_tips,
      access_and_hazard_editorial_review: accessReview.review,
      wave_tips: buildWaveTips(spot),
      crowd_tips: sentenceCase(spot.research_profile.crowd_tendency),
      best_conditions_prose:
        "Static source guidance only. Check the live Quiver forecast and local conditions before paddling out.",
      best_months: deriveBestMonths(seasons),
      wind_offshore_deg:
        windSource == null ? null : Math.round(Number(windSource)),
      wind_offshore_deg_source: windSource,
      wind_offshore_tol_deg: null,
      wind_cross_shore_ok_kt: null,
      wind_onshore_bad_kt: null,
      max_wind_onshore_mph: null,
      max_wind_any_mph: null,
      swell_window_min_deg: swellWindow?.min_deg ?? null,
      swell_window_max_deg: swellWindow?.max_deg ?? null,
      swell_window_evidence: swellWindow,
      preferred_tide_ft_min: tideReview?.preferred_tide_ft_min ?? null,
      preferred_tide_ft_max: tideReview?.preferred_tide_ft_max ?? null,
      preferred_tide_direction:
        tideReview?.preferred_direction ?? "either",
      tide_direction_sensitivity: null,
      tide_preference_editorial_review: tideReview,
      surfline_reference: surflineEvidence
        ? {
            surf_report_url: surflineEvidence.surf_report_url,
            tide_chart_url: surflineEvidence.tide_chart_url,
            surfline_spot_id: surflineEvidence.surfline_spot_id,
            match_method: surflineEvidence.match_method,
            browser_coordinate_validation:
              surflineEvidence.browser_coordinate_validation,
            indexed_guide: surflineEvidence.guide,
            browser_observed: surflineEvidence.browser_observed,
            use_policy: surflineEvidence.permitted_use,
            excluded_use: surflineEvidence.excluded_use,
          }
        : null,
      preference_model: {
        version: "baja-production-enrichment-v2",
        usage: "editorial_swell_windows_with_session_calibration_pending",
        source_break_categories: spot.break_categories,
        source_quality_rating_5: spot.research_profile.source_quality_rating_5,
        source_reliability: spot.research_profile.reliability,
        source_exposure: spot.research_profile.exposure,
        soft_swell_direction_prior: spot.resolution.swell.soft_direction_prior,
        reported_tide_guidance: spot.research_profile.tide,
        skill_candidate: spot.resolution.skill,
        skill_editorial_review: skillReview,
        tide_editorial_review: tideReview,
      },
      forecast_validation: {
        ready: Boolean(forecastProbe?.passed),
        provider_candidate: spot.resolution.forecast.provider_candidate,
        runtime_probe_status: forecastProbe?.passed
          ? "free_tier_probe_passed"
          : isSurfSpot
            ? "free_tier_probe_missing_or_failed"
            : "not_applicable_parent_area",
        grid_distance_checked: Boolean(forecastProbe),
        endpoint: OPEN_METEO_MARINE_URL,
        checked_on: openMeteo.checked_on ?? null,
        requested_coordinate: forecastProbe?.requested_coordinate ?? null,
        returned_grid_coordinate:
          forecastProbe?.returned_grid_coordinate ?? null,
        grid_distance_km: forecastProbe?.grid_distance_km ?? null,
        variable_non_null_hours:
          forecastProbe?.variable_non_null_hours ?? null,
        response_timezone: forecastProbe?.timezone ?? null,
        attribution: openMeteo.attribution ?? null,
      },
      media: {
        hero: heroCandidate ?? fallbackAssetFor(spot, breakType ?? "surf-area"),
        exact_camera_ids: spot.media.live_camera.exact_camera_ids,
        area_camera_ids: spot.media.live_camera.area_camera_ids,
        nearest_camera_reference: spot.media.live_camera.nearest_reference,
        camera_display_policy: spot.media.live_camera.quiver_display_policy,
      },
      editorial_sources: [...new Set(sourceUrls)].map((url) => ({ url })),
      readiness: {
        unresolved: readinessBlockers,
        source_review_priority: spot.data_quality.review_priority,
        source_review_reasons: spot.data_quality.flags ?? {},
      },
    };
  });

  const heroStatusCounts = Object.groupBy
    ? Object.entries(Object.groupBy(spots, (spot) => spot.media.hero.status)).map(
        ([status, values]) => ({ status, count: values.length })
      )
    : [];
  const fallbackIds = [
    ...new Set(
      spots
        .filter((spot) => spot.media.hero.generation_source === "ai_generated")
        .map((spot) => spot.media.hero.source_id)
    ),
  ];

  return {
    schema_version: "2.0.0",
    dataset_id: "baja-surf-spots-production-enrichment-v2-2026-08-27",
    generated_on: new Date().toISOString(),
    source_dataset_id: source.dataset_id,
    source_path: SOURCE_PATH,
    source_inputs: [
      {
        path: SOURCE_PATH,
        dataset_id: source.dataset_id,
        role: "spot facts and reconciliation source",
      },
      {
        path: MEDIA_REGISTRY_PATH,
        dataset_id: mediaRegistry.dataset_id,
        role: "media and camera discovery baseline",
      },
      {
        path: MEDIA_COVERAGE_PATH,
        dataset_id: mediaCoverage.report_id,
        role: "media coverage audit baseline",
      },
    ],
    intended_use:
      "Reviewed catalog import package. Recommendation and SEO gates remain closed until each record clears its readiness blockers.",
    normalization_policy: {
      ids: "Existing Quiver UUIDs are preserved; new UUIDs are deterministic UUIDv5 values derived from the stable source_spot_id.",
      slugs: "Canonical names are NFKD-normalized and kebab-cased; uniqueness is validated across this package.",
      localities:
        "Nearest locality is derived from a cached one-time OpenStreetMap Nominatim reverse-geocode and remains editorial-reviewable.",
      break_type:
        "Quiver canonical value is one of beach, reef, or point. Point wins for point compounds; reef wins for remaining reef compounds; river, rivermouth, and sandbar normalize to beach. Full source categories are retained.",
      wind_direction:
        "Half-degree source bearings are rounded to the nearest integer for the beaches.smallint contract; original values are retained.",
      swell_tide_thresholds:
        "Every rankable surf spot receives an editorial swell window. Exact secondary degree ranges are preferred; existing multi-source windows come next; remaining spots use a disclosed ±22.5° window around the reported ideal direction.",
      media:
        "Exact-location Commons photos are manually approved. Operator-approved generated fallbacks use the accepted beach_photos source value user and retain explicit AI disclosure.",
    },
    licensing_and_runtime_constraints: {
      nominatim:
        "One-time cached research only; comply with OSM attribution and do not use the public endpoint as a production geocoder.",
      open_meteo:
        "The operator approved current use of the Open-Meteo free marine endpoint because Quiver has no paying subscribers. Reassess before monetized production use.",
      wikimedia:
        "Candidate metadata is sourced from Commons, but each file page and exact-location match must be manually reviewed before approval.",
      generated_media:
        "Operator-approved generated images use beach_photos source user. They remain representative illustrations, never proof of exact geography or current conditions.",
      surfline:
        "Public spot sitemaps and search-indexed guides are used for catalog corroboration. Direct pages returned a Cloudflare challenge, /api was not accessed, and transient forecasts are excluded.",
    },
    generated_assets: Object.entries(GENERATED_ASSETS).map(([id, asset]) => ({
      id,
      ...asset,
      dimensions: "1672x941",
      format: "webp",
      status: "approved",
      exact_location_verified: false,
      disclosure:
        "AI-generated representative Baja coastline. Illustrative only; not this exact break or current conditions.",
    })),
    research_references: [
      {
        type: "spot_guide_dataset",
        title: "WaveWise Baja spot guides",
        publisher: "WaveWise",
        url: "https://wavewise.io/surf-spots/mexico/baja-norte",
        scope:
          "Spot-specific skill levels and published lineup/tide guidance. WaveWise discloses that some inputs originate from meta-surf-forecast; cached records retain that provenance limitation.",
      },
      {
        type: "spot_guide_dataset",
        title: "SurfTrips Baja spot guides",
        publisher: "SurfTrips",
        url: "https://surftrips.co/mexico/baja-california",
        scope:
          "Spot-specific skill suitability, tide-stage prose, access, hazards, coordinates, and swell ranges where published.",
      },
      {
        type: "spot_guide_dataset",
        title: "Surfline Baja spot and tide references",
        publisher: "Surfline",
        url: SURFLINE_SPOTS_SITEMAP_URL,
        scope:
          "Canonical Surfline spot IDs and report/tide-page references from the public sitemap, plus ability, ideal-tide, swell, wind, and hazard fields only for guides visible in public search-indexed results.",
      },
      {
        type: "book",
        title: "The Surfer's Guide to Baja",
        author: "Mike Parise",
        edition: 4,
        publisher: "Surf Press Publishers",
        year: 2012,
        isbn: "9780967910055",
        url: "https://books.google.com/books/about/The_Surfer_s_Guide_to_Baja.html?id=EFEquQAACAAJ",
        scope:
          "Regional surf-map and travel methodology reference; not treated as page-level confirmation where full text was unavailable.",
      },
      {
        type: "book",
        title: "Moon Baja: Tijuana to Los Cabos",
        author: "Jennifer Kramer",
        edition: 12,
        publisher: "Moon Travel",
        year: 2023,
        isbn: "9781640499591",
        url: "https://www.hachettebookgroup.com/titles/jennifer-kramer/moon-baja-tijuana-to-los-cabos/9781640499591/",
        scope:
          "Regional road, safety, and access-planning reference; spot facts require separate map or surf-guide evidence.",
      },
    ],
    summary: {
      total_records: spots.length,
      surf_spots: spots.filter((spot) => spot.import_action !== "retain_as_non_rankable_parent_metadata").length,
      parent_areas: spots.filter((spot) => spot.import_action === "retain_as_non_rankable_parent_metadata").length,
      inserts: spots.filter((spot) => spot.import_action === "insert_new").length,
      updates: spots.filter((spot) => spot.import_action === "update_existing_preserve_uuid").length,
      import_eligible: spots.filter((spot) => spot.import_eligible).length,
      missing_locality: spots.filter((spot) => !spot.city).length,
      recommendation_ready: spots.filter((spot) => spot.recommendation_ready).length,
      recommendation_confidence: {
        editorial: spots.filter(
          (spot) =>
            spot.import_eligible &&
            spot.recommendation_confidence === "editorial"
        ).length,
        provisional_editorial: spots.filter(
          (spot) =>
            spot.import_eligible &&
            spot.recommendation_confidence === "provisional_editorial"
        ).length,
      },
      skill_suitability_validated: spots.filter(
        (spot) => spot.skill_suitability_editorial_review?.validated
      ).length,
      tide_stage_sourced: spots.filter(
        (spot) => spot.tide_preference_editorial_review?.preferred_stage
      ).length,
      tide_neutral_policy: spots.filter(
        (spot) =>
          spot.tide_preference_editorial_review?.status ===
          "unknown_neutral_recommendation_policy"
      ).length,
      surfline_spot_references: spots.filter(
        (spot) => spot.surfline_reference?.surf_report_url
      ).length,
      surfline_guide_only_records: spots.filter(
        (spot) =>
          !spot.surfline_reference?.surf_report_url &&
          spot.surfline_reference?.indexed_guide
      ).length,
      surfline_indexed_guides: spots.filter(
        (spot) => spot.surfline_reference?.indexed_guide
      ).length,
      surfline_browser_observed_spots: spots.filter(
        (spot) => spot.surfline_reference?.browser_observed
      ).length,
      hero_status_counts: heroStatusCounts,
      generated_fallback_asset_ids: fallbackIds,
    },
    spots,
  };
}

async function validate(dataset, source) {
  const duplicateValues = (values) => [
    ...new Set(values.filter((value, index) => values.indexOf(value) !== index)),
  ];
  const errors = [];
  const sourceById = new Map(source.spots.map((spot) => [spot.id, spot]));
  const acceptedPhotoSources = new Set([
    "openverse",
    "flickr",
    "unsplash",
    "pexels",
    "wikimedia",
    "user",
    "google_places",
  ]);
  if (dataset.spots.length !== source.spots.length) {
    errors.push("output record count does not match source");
  }
  const ids = dataset.spots.map((spot) => spot.quiver_beach_id);
  const slugs = dataset.spots.map((spot) => spot.slug);
  if (duplicateValues(ids).length) errors.push("duplicate quiver_beach_id");
  if (duplicateValues(slugs).length) errors.push("duplicate slug");
  for (const spot of dataset.spots) {
    const sourceSpot = sourceById.get(spot.source_spot_id);
    if (!sourceSpot) {
      errors.push(`${spot.source_spot_id}: no matching source record`);
      continue;
    }
    const existingId =
      sourceSpot.resolution.quiver_reconciliation.quiver_beach_id;
    if (existingId && existingId !== spot.quiver_beach_id) {
      errors.push(`${spot.source_spot_id}: existing Quiver UUID was not preserved`);
    }
    const sourceWind = sourceSpot.quiver_profile_candidate.wind.wind_offshore_deg;
    if (sourceWind !== spot.wind_offshore_deg_source) {
      errors.push(`${spot.source_spot_id}: source wind bearing was not preserved`);
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(spot.quiver_beach_id)) {
      errors.push(`${spot.source_spot_id}: invalid UUID`);
    }
    if (spot.import_eligible && !spot.city) {
      errors.push(`${spot.source_spot_id}: import eligible without city`);
    }
    if (spot.import_eligible) {
      const expectedTimezone =
        spot.state === "Baja California"
          ? "America/Tijuana"
          : "America/Mazatlan";
      if (spot.timezone !== expectedTimezone) {
        errors.push(
          `${spot.source_spot_id}: expected ${expectedTimezone}, received ${spot.timezone}`
        );
      }
      if (
        spot.swell_window_min_deg == null ||
        spot.swell_window_max_deg == null
      ) {
        errors.push(`${spot.source_spot_id}: missing swell window`);
      }
      if (!spot.access_tips?.trim()) {
        errors.push(`${spot.source_spot_id}: missing access guidance`);
      }
      if (!spot.hazards?.length) {
        errors.push(`${spot.source_spot_id}: missing hazards`);
      }
      if (!spot.forecast_validation.ready) {
        errors.push(`${spot.source_spot_id}: marine forecast probe did not pass`);
      }
      if (!spot.skill_suitability_editorial_review?.validated) {
        errors.push(`${spot.source_spot_id}: skill suitability was not validated`);
      }
      if (!spot.skill_suitability_editorial_review?.evidence?.length) {
        errors.push(`${spot.source_spot_id}: skill validation lacks evidence`);
      }
      if (!spot.tide_preference_editorial_review?.recommendation_policy_ready) {
        errors.push(`${spot.source_spot_id}: tide recommendation policy is unresolved`);
      }
      const tideStage =
        spot.tide_preference_editorial_review?.preferred_stage ?? null;
      if (
        tideStage != null &&
        !["all", "low", "low_to_mid", "mid", "mid_to_high", "high"].includes(
          tideStage
        )
      ) {
        errors.push(`${spot.source_spot_id}: unsupported tide stage ${tideStage}`);
      }
      if (
        tideStage != null &&
        !spot.tide_preference_editorial_review?.evidence?.length
      ) {
        errors.push(`${spot.source_spot_id}: sourced tide stage lacks evidence`);
      }
      if (
        !["editorial", "provisional_editorial"].includes(
          spot.recommendation_confidence
        )
      ) {
        errors.push(`${spot.source_spot_id}: invalid recommendation confidence`);
      }
      if (spot.readiness.unresolved.length) {
        errors.push(`${spot.source_spot_id}: unresolved readiness blockers remain`);
      }
      if (!spot.recommendation_ready) {
        errors.push(`${spot.source_spot_id}: recommendation readiness is false`);
      }
      if (spot.forecast_validation.response_timezone !== "GMT") {
        errors.push(`${spot.source_spot_id}: marine probe response was not GMT`);
      }
      if (spot.editorial_sources.length < 4) {
        errors.push(`${spot.source_spot_id}: insufficient editorial sources`);
      }
    }
    if (spot.break_type && !["beach", "reef", "point"].includes(spot.break_type)) {
      errors.push(`${spot.source_spot_id}: invalid break_type`);
    }
    if (spot.wind_offshore_deg != null && !Number.isInteger(spot.wind_offshore_deg)) {
      errors.push(`${spot.source_spot_id}: non-integer wind_offshore_deg`);
    }
    if (spot.media.hero.generation_source === "ai_generated" && !spot.media.hero.attribution_html.includes("Illustrative only")) {
      errors.push(`${spot.source_spot_id}: generated media missing disclosure`);
    }
    if (!acceptedPhotoSources.has(spot.media.hero.source)) {
      errors.push(
        `${spot.source_spot_id}: unsupported beach_photos.source ${spot.media.hero.source}`
      );
    }
  }
  for (const asset of dataset.generated_assets) {
    const publicPath = path.resolve("public", asset.local_path.replace(/^\/images\//, "images/"));
    try {
      await access(publicPath);
    } catch {
      errors.push(`${asset.id}: generated asset is missing at ${publicPath}`);
    }
  }
  if (errors.length) {
    throw new Error(`Validation failed:\n${errors.join("\n")}`);
  }
  process.stdout.write(`validated ${dataset.spots.length} records\n`);
}

function buildSkillTideResearchReport(dataset, source) {
  const outputById = new Map(
    dataset.spots.map((spot) => [spot.source_spot_id, spot])
  );
  const recordsForBlocker = (blocker) =>
    source.spots
      .filter(
        (spot) =>
          spot.resolution.identity.entity_type === "surf_spot" &&
          spot.resolution.readiness.remaining_blockers.includes(blocker)
      )
      .map((spot) => {
        const output = outputById.get(spot.id);
        return {
          source_spot_id: spot.id,
          name: output.name,
          skill_level: output.skill_level,
          skill_review: output.skill_suitability_editorial_review,
          tide_review: output.tide_preference_editorial_review,
          recommendation_ready: output.recommendation_ready,
          recommendation_confidence: output.recommendation_confidence,
        };
      });
  const skillRecords = recordsForBlocker("validate_skill_suitability");
  const tideObservationRecords = recordsForBlocker(
    "collect_tide_stage_or_height_observations"
  );
  const tideCalibrationRecords = recordsForBlocker(
    "calibrate_tide_preference_before_hard_gating"
  );
  return {
    schema_version: "1.0.0",
    dataset_id: "baja-skill-tide-research-2026-08-27",
    generated_on: dataset.generated_on,
    decision:
      "Recommendation eligibility may use sourced tide stages as soft inputs and an explicit neutral policy when no stage evidence exists. Numeric tide heights remain unset without local-datum observations.",
    summary: {
      original_skill_blockers: skillRecords.length,
      skill_blockers_with_spot_specific_evidence: skillRecords.filter(
        (record) => record.skill_review.validated
      ).length,
      original_tide_observation_blockers: tideObservationRecords.length,
      tide_observation_blockers_with_sourced_stage:
        tideObservationRecords.filter(
          (record) => record.tide_review.preferred_stage
        ).length,
      tide_observation_blockers_using_neutral_policy:
        tideObservationRecords.filter(
          (record) => !record.tide_review.preferred_stage
        ).length,
      original_tide_calibration_blockers: tideCalibrationRecords.length,
      tide_calibration_corroborated: tideCalibrationRecords.filter((record) =>
        record.tide_review.status.includes("corroborated")
      ).length,
      tide_calibration_conflicts: tideCalibrationRecords.filter((record) =>
        record.tide_review.status.includes("conflicts")
      ).length,
      tide_calibration_single_source: tideCalibrationRecords.filter(
        (record) =>
          record.tide_review.status ===
          "published_stage_guidance_single_source"
      ).length,
      tide_calibration_neutral_policy: tideCalibrationRecords.filter(
        (record) =>
          record.tide_review.status ===
          "unknown_neutral_recommendation_policy"
      ).length,
    },
    skill_blocker_records: skillRecords,
    tide_observation_blocker_records: tideObservationRecords,
    tide_calibration_blocker_records: tideCalibrationRecords,
  };
}

async function main() {
  const mode = process.argv[2] ?? "build";
  const source = await readJson(SOURCE_PATH);
  const mediaRegistry = await readJson(MEDIA_REGISTRY_PATH);
  const mediaCoverage = await readJson(MEDIA_COVERAGE_PATH);
  await mkdir(RESEARCH_ROOT, { recursive: true });

  if (mode === "fetch-geocodes") {
    await fetchGeocodes(source);
    return;
  }
  if (mode === "fetch-geocode-fallbacks") {
    await fetchGeocodeSearchFallbacks(source);
    return;
  }
  if (mode === "fetch-commons") {
    await fetchCommonsCandidates(source);
    return;
  }
  if (mode === "fetch-surftrips") {
    await fetchSurfTripsEditorial();
    return;
  }
  if (mode === "fetch-wavewise") {
    await fetchWaveWiseEditorial();
    return;
  }
  if (mode === "fetch-surfline-index") {
    await fetchSurflineIndex(source);
    return;
  }
  if (mode === "fetch-open-meteo") {
    const geocodes = await readJson(GEOCODE_PATH);
    const surfTrips = await readJson(SURFTRIPS_PATH);
    await fetchOpenMeteoMarine(source, geocodes, surfTrips);
    return;
  }
  if (mode === "fetch-targeted-commons") {
    await fetchTargetedCommonsCandidates(source);
    return;
  }
  if (mode !== "build") {
    throw new Error(`Unknown mode: ${mode}`);
  }

  const geocodes = await readJson(GEOCODE_PATH);
  const commons = await readJson(COMMONS_PATH);
  const surfTrips = await readJson(SURFTRIPS_PATH);
  const waveWise = await readJson(WAVEWISE_PATH, { results: {} });
  const surfline = await readJson(SURFLINE_PATH, { results: {} });
  const openMeteo = await readJson(OPEN_METEO_PATH, {
    checked_on: null,
    attribution: null,
    results: {},
  });
  if (mediaRegistry.spots?.length !== source.spots.length) {
    throw new Error("Media registry spot count does not match the source dataset");
  }
  if (mediaCoverage.summary?.total_spots !== source.spots.length) {
    throw new Error("Media coverage spot count does not match the source dataset");
  }
  const dataset = buildProductionDataset(
    source,
    mediaRegistry,
    mediaCoverage,
    geocodes,
    commons,
    surfTrips,
    waveWise,
    surfline,
    openMeteo
  );
  await validate(dataset, source);
  await writeJson(OUTPUT_PATH, dataset);
  await writeJson(
    SKILL_TIDE_REPORT_PATH,
    buildSkillTideResearchReport(dataset, source)
  );
  process.stdout.write(`${OUTPUT_PATH}\n`);
}

await main();
