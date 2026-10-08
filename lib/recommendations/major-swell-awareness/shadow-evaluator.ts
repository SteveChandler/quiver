export type OfficialSwellAdvisoryKind =
  | "high_surf"
  | "tropical_cyclone"
  | "high_rip_current";

export interface OfficialSwellAdvisoryEvidence {
  evidenceRef: string;
  kind: OfficialSwellAdvisoryKind;
  startsAt: string;
  endsAt: string;
  beachIds: string[];
}
