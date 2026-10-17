/** Beach names can contain punctuation that must not reach a push title. */
export function pushTitle(text: string): string {
  return text
    .replace(/[-—–]+(?![-—–])(?=\p{P})/gu, "")
    .replace(/[—–]+|(^|\s)-+|-+(?=\s|$)/g, " ")
    .replace(/\s+([,.;:!?\p{Pe}\p{Pf}])/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
