/** Beach names can contain punctuation that must not reach a push title. */
export function pushTitle(text: string): string {
  return text.replace(/\s*[—–]\s*| - /g, " ").trim();
}
