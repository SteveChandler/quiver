/** Source of the hidden session a conditions report writes. */
export const CONDITIONS_REPORT_SOURCE = "conditions_report";

/**
 * PostgREST `.or()` filter that drops conditions-report sessions, which are hidden rows written
 * so report videos pass the public media RLS arm, not surfs. Matches the SQL
 * `source IS DISTINCT FROM 'conditions_report'`; a bare `neq` would also drop NULL sources.
 */
export const SURF_SESSION_SOURCE_FILTER = `source.is.null,source.neq.${CONDITIONS_REPORT_SOURCE}`;
