export type ShownCall = {
  callId: string;
  beachId: string;
  forecastAt: string;
  surface: string | null;
  label: string | null;
  boardId: string | null;
  boardName: string | null;
  boardType: string | null;
  isAnyBoard: boolean;
  isPersonal: true;
  shownAt: string;
};

export function metadataCall(row: { metadata: Record<string, unknown>; beach_id: string | null; created_at: string }): ShownCall | null {
  if (row.metadata.is_personal !== true) return null;
  const callId = typeof row.metadata.call_id === "string" ? row.metadata.call_id : null;
  const forecastAt = typeof row.metadata.forecast_at === "string"
    ? row.metadata.forecast_at
    : typeof row.metadata.selected_forecast_at === "string"
      ? row.metadata.selected_forecast_at
      : null;
  if (!callId || !forecastAt || !row.beach_id || Number.isNaN(Date.parse(forecastAt))) return null;
  return {
    callId,
    beachId: row.beach_id,
    forecastAt,
    surface: typeof row.metadata.surface === "string" ? row.metadata.surface : null,
    label: typeof row.metadata.label === "string" ? row.metadata.label : null,
    boardId: typeof row.metadata.board_id === "string" ? row.metadata.board_id : null,
    boardName: null,
    boardType: null,
    isAnyBoard: row.metadata.is_any_board === true,
    isPersonal: true,
    shownAt: row.created_at,
  };
}
