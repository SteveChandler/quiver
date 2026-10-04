// TODO(swell-followups): replaced by feat/swell-followups
// Temporary stub so the share page and image can ship in parallel. On merge,
// take the feat/swell-followups version of this whole file.

export type SwellKind = 'coming' | 'bigger' | 'smaller' | 'moved' | 'dropped' | 'arrived'

interface HeadlineEntry {
  id: string
  template: string
}

const POOL: Record<SwellKind, HeadlineEntry[]> = {
  coming: [
    { id: 'coming-1', template: 'Cancel your plans. {beach}, {day}.' },
    { id: 'coming-2', template: "Tell your boss it's a dentist thing." },
  ],
  bigger: [
    { id: 'bigger-1', template: "Remember {day}? It's been lifting." },
    { id: 'bigger-2', template: 'It grew. Your excuses should too.' },
  ],
  smaller: [
    { id: 'smaller-1', template: 'Uncancel one plan. {day} shrank.' },
    { id: 'smaller-2', template: 'Still on. Just less to brag about.' },
  ],
  moved: [
    { id: 'moved-1', template: "Swell's running late. Now {day}. Reschedule your fake dentist." },
    { id: 'moved-2', template: 'New day, same swell. Check your alibi.' },
  ],
  dropped: [
    { id: 'dropped-1', template: 'Never mind. Go to work.' },
    { id: 'dropped-2', template: 'The swell saw {beach} and kept driving.' },
  ],
  arrived: [
    { id: 'arrived-1', template: 'It showed up. Did you?' },
    { id: 'arrived-2', template: "It's here. Your inbox can wait." },
  ],
}

const SERIOUS: Record<SwellKind, HeadlineEntry> = {
  coming: { id: 'serious-coming', template: 'Serious swell at {beach}' },
  bigger: { id: 'serious-bigger', template: 'Forecast is up at {beach}' },
  smaller: { id: 'serious-smaller', template: 'Forecast is down at {beach}' },
  moved: { id: 'serious-moved', template: 'Peak has moved at {beach}' },
  dropped: { id: 'serious-dropped', template: 'Swell no longer forecast for {beach}' },
  arrived: { id: 'serious-arrived', template: 'Serious swell is at {beach} now' },
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function getSwellCardHeadline(args: {
  titleId?: string
  kind: SwellKind
  eventKey: string
  beachName: string
  peakDayLabel?: string
  serious?: boolean
}): { titleId: string; headline: string } {
  const usable = (args.serious ? [SERIOUS[args.kind]] : POOL[args.kind]).filter(
    (entry) => args.peakDayLabel || !entry.template.includes('{day}'),
  )
  const entry =
    usable.find((candidate) => candidate.id === args.titleId) ??
    usable[hash(args.eventKey) % usable.length]
  return {
    titleId: entry.id,
    headline: entry.template
      .replace('{beach}', args.beachName)
      .replace('{day}', args.peakDayLabel ?? ''),
  }
}
