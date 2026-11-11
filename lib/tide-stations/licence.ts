/**
 * Licence rules for public tide station pages. Quiver is a commercial product,
 * so a station is listed only when its data can be shown commercially.
 *
 * TICON-4 is CC BY 4.0 (SEANOE, https://doi.org/10.17882/109129), but its
 * constants come from GESLA-4 sea-level records whose providers set their own
 * terms. The GESLA licence page (https://gesla787883612.wordpress.com/license/)
 * marks CMEMS, UZ and CV "research only"; every other listed provider allows
 * research and consultancy. A provider missing from that table is excluded
 * until its terms are checked.
 */

export const TICON_CITATION =
  "Hart-Davis, M., Dettmering, D., Seitz, F. (2025). TICON-4: TIdal CONstants based on GESLA-4 sea-level records. SEANOE. https://doi.org/10.17882/109129";

export const NOAA_LICENCE = {
  licence: "us-public-domain",
  licenceUrl: "https://tidesandcurrents.noaa.gov/disclaimers.html",
  attribution: "Tide predictions from NOAA CO-OPS (tidesandcurrents.noaa.gov).",
} as const;

/** GESLA providers marked research and consultancy, keyed by `gesla_source` suffix. */
const GESLA_COMMERCIAL_PROVIDERS: Readonly<Record<string, string>> = {
  BFG: "Federal Institute of Hydrology (Germany)",
  BODC: "British Oceanographic Data Centre",
  BOM: "Bureau of Meteorology (Australia)",
  CCO: "Coastal Channel Observatory",
  CDWR: "California Department of Water Resources",
  DA: "GESLA data archaeology",
  DMI: "Danish Meteorological Institute",
  ESEAS: "European Sea-Level Service",
  FMI: "Finnish Meteorological Institute",
  GLOSS: "Global Sea Level Observing System",
  ICG: "Icelandic Coast Guard",
  IEO: "Spanish Institute of Oceanography",
  ISPRA: "ISPRA (Italy)",
  JODC_GIAJ: "Japan Oceanographic Data Center / Geospatial Information Authority of Japan",
  JODC_JCG: "Japan Oceanographic Data Center / Japan Coast Guard",
  JODC_JMA: "Japan Oceanographic Data Center / Japan Meteorological Agency",
  JODC_PAHB: "Japan Oceanographic Data Center / Ports and Harbours Bureau",
  MEDS: "Marine Environmental Data Section (Canada)",
  MI_C: "Marine Institute (Ireland)",
  MI_R: "Marine Institute (Ireland)",
  NCDEM: "North Carolina Department of Emergency Management",
  NHS: "Norwegian Hydrographic Service",
  NOAA: "NOAA",
  NOC: "National Oceanography Centre",
  NWFWMD: "Northwest Florida Water Management District",
  REFMAR: "REFMAR (France)",
  RWS: "Rijkswaterstaat",
  SFWMD: "South Florida Water Management District",
  SMHI: "Swedish Meteorological and Hydrological Institute",
  UHSLC: "University of Hawaii Sea Level Center",
  UNAM: "National Autonomous University of Mexico",
  USGS: "United States Geological Survey",
  WSV: "Federal Waterways and Shipping Administration (Germany)",
};

/**
 * GESLA-4 splits some providers into delivery streams (UHSLC research-quality and
 * fast-delivery, historic archives). They are the same provider and the same terms.
 * DA_* streams stay excluded: nothing on the licence page ties them to "DA".
 */
const GESLA_PROVIDER_STREAMS: Readonly<Record<string, string>> = {
  RWS_HIST: "RWS",
  UHSLC_FD: "UHSLC",
  UHSLC_RQ: "UHSLC",
  UNAM_HIST: "UNAM",
};

const GESLA_RESEARCH_ONLY_PROVIDERS: ReadonlySet<string> = new Set(["CMEMS", "CV", "UZ"]);

type TiconLicenceDecision =
  | {
      included: true;
      provider: string;
      providerName: string;
      licence: "cc-by-4.0";
      licenceUrl: string;
      attribution: string;
    }
  | { included: false; provider: string; reason: "research-only" | "unverified-provider" };

/** "gesla4.CMEMS" -> "CMEMS"; "gesla4.JODC_JMA" -> "JODC_JMA". */
export function geslaProvider(geslaSource: string): string {
  const raw = geslaSource.trim();
  const dot = raw.lastIndexOf(".");
  return (dot >= 0 ? raw.slice(dot + 1) : raw).toUpperCase();
}

export function classifyTiconLicence(geslaSource: string): TiconLicenceDecision {
  const provider = geslaProvider(geslaSource);
  const researchOnly = [...GESLA_RESEARCH_ONLY_PROVIDERS].some((p) => provider === p || provider.startsWith(`${p}_`));
  if (researchOnly) {
    return { included: false, provider, reason: "research-only" };
  }
  const providerName = GESLA_COMMERCIAL_PROVIDERS[GESLA_PROVIDER_STREAMS[provider] ?? provider];
  if (!providerName) {
    return { included: false, provider, reason: "unverified-provider" };
  }
  return {
    included: true,
    provider,
    providerName,
    licence: "cc-by-4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: `Tidal constants: ${TICON_CITATION}, CC BY 4.0, from ${providerName} sea-level records via GESLA-4. Quiver computes the predictions from these constants.`,
  };
}
